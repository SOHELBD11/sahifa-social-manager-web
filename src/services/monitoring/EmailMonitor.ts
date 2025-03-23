import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import { EmailAnalytics } from '@/services/notifications/EmailAnalytics';
import { NotificationService } from '@/services/notifications/NotificationService';
import { RateLimiter } from './RateLimiter';

interface MonitoringThresholds {
  deliveryRate: number;  // minimum acceptable delivery rate (%)
  openRate: number;      // minimum acceptable open rate (%)
  clickRate: number;     // minimum acceptable click rate (%)
  failureCount: number;  // maximum acceptable consecutive failures
  responseTime: number;  // maximum acceptable delivery time (ms)
}

interface AlertConfig {
  userId: string;
  enabled: boolean;
  thresholds: MonitoringThresholds;
  notificationChannels: {
    email: boolean;
    dashboard: boolean;
    slack?: string;  // Slack webhook URL
  };
  cooldown: number;  // minutes between repeated alerts
}

interface MonitoringAlert {
  id: string;
  userId: string;
  type: 'delivery_rate' | 'open_rate' | 'click_rate' | 'failures' | 'response_time';
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  status: 'active' | 'resolved';
  resolvedAt?: Date;
  platform?: string;
  details?: string;
}

export class EmailMonitor {
  private static readonly ALERT_CONFIG_COLLECTION = 'email_monitor_config';
  private static readonly ALERTS_COLLECTION = 'email_monitor_alerts';
  private static readonly DEFAULT_THRESHOLDS: MonitoringThresholds = {
    deliveryRate: 95,    // 95% minimum delivery rate
    openRate: 15,        // 15% minimum open rate
    clickRate: 2,        // 2% minimum click rate
    failureCount: 3,     // Max 3 consecutive failures
    responseTime: 10000, // Max 10 seconds delivery time
  };

  static async getAlertConfig(userId: string): Promise<AlertConfig> {
    try {
      const configRef = doc(db, this.ALERT_CONFIG_COLLECTION, userId);
      const configDoc = await getDoc(configRef);

      if (!configDoc.exists()) {
        // Create default config if none exists
        const defaultConfig: AlertConfig = {
          userId,
          enabled: true,
          thresholds: this.DEFAULT_THRESHOLDS,
          notificationChannels: {
            email: true,
            dashboard: true,
          },
          cooldown: 30, // 30 minutes default cooldown
        };
        await setDoc(configRef, defaultConfig);
        return defaultConfig;
      }

      return configDoc.data() as AlertConfig;
    } catch (error) {
      console.error('Error getting alert config:', error);
      throw error;
    }
  }

  static async updateAlertConfig(userId: string, config: Partial<AlertConfig>): Promise<void> {
    try {
      const configRef = doc(db, this.ALERT_CONFIG_COLLECTION, userId);
      await setDoc(configRef, config, { merge: true });
    } catch (error) {
      console.error('Error updating alert config:', error);
      throw error;
    }
  }

  static async startMonitoring(userId: string): Promise<() => void> {
    const config = await this.getAlertConfig(userId);
    if (!config.enabled) return () => {};

    // Monitor real-time metrics
    const metricsUnsubscribe = this.monitorMetrics(userId, config);
    
    // Monitor delivery failures
    const failuresUnsubscribe = this.monitorFailures(userId, config);

    // Return cleanup function
    return () => {
      metricsUnsubscribe();
      failuresUnsubscribe();
    };
  }

  private static monitorMetrics(userId: string, config: AlertConfig): () => void {
    const checkMetrics = async () => {
      try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 60 * 60 * 1000); // Last hour
        const metrics = await EmailAnalytics.getMetrics(userId, startDate, endDate);

        // Check delivery rate
        const deliveryRate = (metrics.delivered / metrics.totalSent) * 100;
        if (deliveryRate < config.thresholds.deliveryRate) {
          await this.createAlert(userId, {
            type: 'delivery_rate',
            metric: 'Delivery Rate',
            value: deliveryRate,
            threshold: config.thresholds.deliveryRate,
            details: `Delivery rate dropped to ${deliveryRate.toFixed(1)}%`
          });
        }

        // Check open rate
        const openRate = (metrics.opened / metrics.delivered) * 100;
        if (openRate < config.thresholds.openRate) {
          await this.createAlert(userId, {
            type: 'open_rate',
            metric: 'Open Rate',
            value: openRate,
            threshold: config.thresholds.openRate,
            details: `Open rate dropped to ${openRate.toFixed(1)}%`
          });
        }

        // Check click rate
        const clickRate = (metrics.clicked / metrics.opened) * 100;
        if (clickRate < config.thresholds.clickRate) {
          await this.createAlert(userId, {
            type: 'click_rate',
            metric: 'Click Rate',
            value: clickRate,
            threshold: config.thresholds.clickRate,
            details: `Click rate dropped to ${clickRate.toFixed(1)}%`
          });
        }

        // Check platform-specific metrics
        for (const [platform, stats] of Object.entries(metrics.byPlatform)) {
          const platformOpenRate = (stats.opened / stats.sent) * 100;
          if (platformOpenRate < config.thresholds.openRate) {
            await this.createAlert(userId, {
              type: 'open_rate',
              metric: 'Platform Open Rate',
              value: platformOpenRate,
              threshold: config.thresholds.openRate,
              platform,
              details: `${platform} open rate dropped to ${platformOpenRate.toFixed(1)}%`
            });
          }
        }
      } catch (error) {
        console.error('Error monitoring metrics:', error);
      }
    };

    // Run initial check
    checkMetrics();

    // Set up interval for periodic checks
    const intervalId = setInterval(checkMetrics, 5 * 60 * 1000); // Check every 5 minutes

    // Return cleanup function
    return () => clearInterval(intervalId);
  }

  private static monitorFailures(userId: string, config: AlertConfig): () => void {
    const failuresRef = collection(db, 'email_queue');
    const failuresQuery = query(
      failuresRef,
      where('userId', '==', userId),
      where('status', '==', 'failed')
    );

    return onSnapshot(failuresQuery, async (snapshot) => {
      try {
        const recentFailures = snapshot.docs
          .map(doc => ({
            ...doc.data(),
            id: doc.id,
            createdAt: doc.data().createdAt?.toDate()
          }))
          .filter(failure => {
            const failureTime = failure.createdAt?.getTime() || 0;
            return Date.now() - failureTime < 15 * 60 * 1000; // Last 15 minutes
          });

        if (recentFailures.length >= config.thresholds.failureCount) {
          await this.createAlert(userId, {
            type: 'failures',
            metric: 'Consecutive Failures',
            value: recentFailures.length,
            threshold: config.thresholds.failureCount,
            details: `${recentFailures.length} email delivery failures in the last 15 minutes`
          });
        }
      } catch (error) {
        console.error('Error monitoring failures:', error);
      }
    });
  }

  private static async createAlert(
    userId: string,
    alert: Pick<MonitoringAlert, 'type' | 'metric' | 'value' | 'threshold' | 'details' | 'platform'>
  ): Promise<void> {
    try {
      const config = await this.getAlertConfig(userId);
      
      // Check cooldown period
      const recentAlertQuery = query(
        collection(db, this.ALERTS_COLLECTION),
        where('userId', '==', userId),
        where('type', '==', alert.type),
        where('status', '==', 'active')
      );
      
      const recentAlerts = await getDocs(recentAlertQuery);
      if (!recentAlerts.empty) {
        const lastAlert = recentAlerts.docs[0].data();
        const timeSinceLastAlert = Date.now() - lastAlert.timestamp.toDate().getTime();
        if (timeSinceLastAlert < config.cooldown * 60 * 1000) {
          return; // Still in cooldown period
        }
      }

      // Check rate limits
      const isAlertLimited = await RateLimiter.isRateLimited({
        userId,
        type: 'alert',
        windowSize: 60000,  // 1 minute
        maxRequests: 10     // 10 alerts per minute
      });

      if (isAlertLimited) {
        console.warn(`Alert rate limit exceeded for user ${userId}`);
        return;
      }

      // Create new alert
      const alertDoc = {
        ...alert,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        timestamp: new Date(),
        status: 'active' as const
      };

      await setDoc(doc(db, this.ALERTS_COLLECTION, alertDoc.id), alertDoc);

      // Send notifications with rate limiting
      if (config.notificationChannels.email) {
        const isEmailLimited = await RateLimiter.isRateLimited({
          userId,
          type: 'email',
          windowSize: 3600000,  // 1 hour
          maxRequests: 100      // 100 emails per hour
        });

        if (!isEmailLimited) {
          await NotificationService.sendEmailAlert({
            to: userId,
            subject: `Email Monitoring Alert: ${alert.metric} Issue Detected`,
            type: 'monitoring',
            data: {
              metric: alert.metric,
              value: alert.value,
              threshold: alert.threshold,
              details: alert.details,
              platform: alert.platform
            }
          });
        } else {
          console.warn(`Email rate limit exceeded for user ${userId}`);
        }
      }

      if (config.notificationChannels.slack && config.notificationChannels.slack.length > 0) {
        const isNotificationLimited = await RateLimiter.isRateLimited({
          userId,
          type: 'notification',
          windowSize: 300000,   // 5 minutes
          maxRequests: 50       // 50 notifications per 5 minutes
        });

        if (!isNotificationLimited) {
          // Send Slack notification
          await fetch(config.notificationChannels.slack, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 *Email Monitoring Alert*\n${alert.details}\nMetric: ${alert.metric}\nValue: ${alert.value}\nThreshold: ${alert.threshold}${alert.platform ? `\nPlatform: ${alert.platform}` : ''}`
            })
          });
        } else {
          console.warn(`Notification rate limit exceeded for user ${userId}`);
        }
      }
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  }

  static async resolveAlert(alertId: string): Promise<void> {
    try {
      const alertRef = doc(db, this.ALERTS_COLLECTION, alertId);
      await setDoc(alertRef, {
        status: 'resolved',
        resolvedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }
  }

  static async getActiveAlerts(userId: string): Promise<MonitoringAlert[]> {
    try {
      const alertsQuery = query(
        collection(db, this.ALERTS_COLLECTION),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(alertsQuery);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MonitoringAlert[];
    } catch (error) {
      console.error('Error getting active alerts:', error);
      throw error;
    }
  }

  static async getRateLimitStatus(userId: string): Promise<{
    alerts: { remaining: number; resetTime: Date; isLimited: boolean };
    emails: { remaining: number; resetTime: Date; isLimited: boolean };
    notifications: { remaining: number; resetTime: Date; isLimited: boolean };
  }> {
    const [alerts, emails, notifications] = await Promise.all([
      RateLimiter.getRateLimitStatus(userId, 'alert'),
      RateLimiter.getRateLimitStatus(userId, 'email'),
      RateLimiter.getRateLimitStatus(userId, 'notification')
    ]);

    return {
      alerts,
      emails,
      notifications
    };
  }
} 