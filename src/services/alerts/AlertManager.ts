import { db } from '@/lib/firebase';
import { doc, collection, addDoc, getDoc, getDocs, query, where, orderBy, limit, setDoc } from 'firebase/firestore';
import { Platform } from '@/services/TokenManager';
import { NotificationService } from '@/services/notifications/NotificationService';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AlertThreshold {
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  value: number;
  severity: AlertSeverity;
}

export interface Alert {
  id: string;
  userId: string;
  platform: Platform;
  message: string;
  severity: AlertSeverity;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}

export class AlertManager {
  private static readonly ALERTS_COLLECTION = 'alerts';
  private static readonly THRESHOLDS_COLLECTION = 'alert_thresholds';

  private static readonly DEFAULT_THRESHOLDS: AlertThreshold[] = [
    {
      metric: 'errorRate',
      condition: 'gt',
      value: 10, // Error rate > 10%
      severity: 'warning'
    },
    {
      metric: 'avgPublishDuration',
      condition: 'gt',
      value: 5000, // Average publish duration > 5000ms
      severity: 'warning'
    },
    {
      metric: 'successRate',
      condition: 'lt',
      value: 90, // Success rate < 90%
      severity: 'error'
    }
  ];

  static async initializeThresholds(userId: string): Promise<void> {
    try {
      const thresholdsRef = doc(db, this.THRESHOLDS_COLLECTION, userId);
      const thresholdsDoc = await getDoc(thresholdsRef);

      if (!thresholdsDoc.exists()) {
        await setDoc(thresholdsRef, {
          thresholds: this.DEFAULT_THRESHOLDS,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error initializing alert thresholds:', error);
    }
  }

  static async updateThresholds(
    userId: string,
    thresholds: AlertThreshold[]
  ): Promise<void> {
    try {
      await setDoc(doc(db, this.THRESHOLDS_COLLECTION, userId), {
        thresholds,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating alert thresholds:', error);
      throw error;
    }
  }

  static async getThresholds(userId: string): Promise<AlertThreshold[]> {
    try {
      const thresholdsDoc = await getDoc(doc(db, this.THRESHOLDS_COLLECTION, userId));
      return thresholdsDoc.exists() ? thresholdsDoc.data().thresholds : this.DEFAULT_THRESHOLDS;
    } catch (error) {
      console.error('Error getting alert thresholds:', error);
      return this.DEFAULT_THRESHOLDS;
    }
  }

  static async checkMetricThresholds(
    userId: string,
    platform: Platform,
    metrics: { [key: string]: number }
  ): Promise<void> {
    try {
      const thresholds = await this.getThresholds(userId);

      for (const threshold of thresholds) {
        const metricValue = metrics[threshold.metric];
        if (metricValue === undefined) continue;

        let thresholdExceeded = false;
        switch (threshold.condition) {
          case 'gt':
            thresholdExceeded = metricValue > threshold.value;
            break;
          case 'lt':
            thresholdExceeded = metricValue < threshold.value;
            break;
          case 'eq':
            thresholdExceeded = metricValue === threshold.value;
            break;
        }

        if (thresholdExceeded) {
          await this.createAlert({
            userId,
            platform,
            message: `${threshold.metric} threshold exceeded for ${platform}`,
            severity: threshold.severity,
            metric: threshold.metric,
            value: metricValue,
            threshold: threshold.value,
            timestamp: new Date(),
            acknowledged: false
          });
        }
      }
    } catch (error) {
      console.error('Error checking metric thresholds:', error);
    }
  }

  static async createAlert(alert: Omit<Alert, 'id'>): Promise<string> {
    try {
      const alertsRef = collection(db, this.ALERTS_COLLECTION);
      const docRef = await addDoc(alertsRef, alert);

      // Get user's notification preferences and send notification if needed
      const preferences = await NotificationService.getNotificationPreferences(alert.userId);
      if (preferences) {
        await NotificationService.queueEmailNotification(alert.userId, {
          ...alert,
          id: docRef.id
        }, preferences);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  }

  static async getAlerts(
    userId: string,
    options: {
      acknowledged?: boolean;
      severity?: AlertSeverity;
      platform?: Platform;
      limit?: number;
    } = {}
  ): Promise<Alert[]> {
    try {
      const alertsRef = collection(db, this.ALERTS_COLLECTION);
      let q = query(alertsRef, where('userId', '==', userId));

      if (options.acknowledged !== undefined) {
        q = query(q, where('acknowledged', '==', options.acknowledged));
      }
      if (options.severity) {
        q = query(q, where('severity', '==', options.severity));
      }
      if (options.platform) {
        q = query(q, where('platform', '==', options.platform));
      }

      q = query(q, orderBy('timestamp', 'desc'));
      if (options.limit) {
        q = query(q, limit(options.limit));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<Alert, 'id'>
      }));
    } catch (error) {
      console.error('Error getting alerts:', error);
      return [];
    }
  }

  static async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      await setDoc(
        doc(db, this.ALERTS_COLLECTION, alertId),
        { acknowledged: true },
        { merge: true }
      );
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }
} 