import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp, orderBy, addDoc } from 'firebase/firestore';
import nodemailer from 'nodemailer';
import { compile } from 'handlebars';
import { Alert } from '@/services/alerts/AlertManager';
import { EmailAnalytics } from './EmailAnalytics';

interface QueuedEmail {
  id: string;
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  userId: string;
  createdAt: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  error?: string;
  retryCount?: number;
}

interface DigestData {
  alerts: Alert[];
  period: 'hourly' | 'daily';
  platformStats: {
    [platform: string]: {
      total: number;
      bySeverity: { [severity: string]: number };
    };
  };
}

export class EmailWorker {
  private static readonly EMAIL_QUEUE_COLLECTION = 'email_queue';
  private static readonly ALERTS_COLLECTION = 'alerts';
  private static readonly MAX_RETRIES = 3;
  private static readonly BATCH_SIZE = 50;

  private static readonly emailTemplates = {
    'alert-notification': compile(`
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/api/email/track/open/{{emailId}}" width="1" height="1" style="display:none" alt="" />
        <h2 style="color: {{severityColor}};">[{{severity}}] Alert for {{platform}}</h2>
        <p><strong>{{message}}</strong></p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>Metric:</strong> {{metric}}</p>
          <p><strong>Value:</strong> {{value}}</p>
          <p><strong>Threshold:</strong> {{threshold}}</p>
          <p><strong>Time:</strong> {{timestamp}}</p>
        </div>
        <p style="font-size: 0.9em; color: #666;">
          View more details in your dashboard: 
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/api/email/track/click/{{emailId}}?url=${encodeURIComponent('{{dashboardUrl}}/analytics')}">Analytics Dashboard</a>
        </p>
      </div>
    `),
    'alert-digest': compile(`
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/api/email/track/open/{{emailId}}" width="1" height="1" style="display:none" alt="" />
        <h2 style="color: #2c3e50;">Alert Digest - {{period}} Summary</h2>
        <p>Here's a summary of alerts from the past {{timeframe}}:</p>

        {{#if platformStats}}
        <div style="margin: 20px 0;">
          <h3 style="color: #34495e;">Platform Overview</h3>
          {{#each platformStats}}
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">{{@key}} ({{this.total}} alerts)</h4>
            <div style="display: flex; gap: 10px;">
              {{#each this.bySeverity}}
              <span style="background: {{getSeverityColor @key}}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 0.9em;">
                {{@key}}: {{this}}
              </span>
              {{/each}}
            </div>
          </div>
          {{/each}}
        </div>
        {{/if}}

        <div style="margin: 20px 0;">
          <h3 style="color: #34495e;">Recent Alerts</h3>
          {{#each alerts}}
          <div style="border-left: 4px solid {{getSeverityColor severity}}; background: #f8f9fa; padding: 15px; margin: 10px 0;">
            <p style="margin: 0 0 5px 0;"><strong style="color: {{getSeverityColor severity}};">[{{severity}}]</strong> {{message}}</p>
            <p style="margin: 0; color: #666; font-size: 0.9em;">
              {{platform}} | {{metric}}: {{value}} (threshold: {{threshold}})
            </p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 0.8em;">
              {{formatDate timestamp}}
            </p>
          </div>
          {{/each}}
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="font-size: 0.9em; color: #666;">
            View complete details in your dashboard: 
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/api/email/track/click/{{emailId}}?url=${encodeURIComponent('{{dashboardUrl}}/analytics')}">Analytics Dashboard</a>
          </p>
          <p style="font-size: 0.8em; color: #666;">
            You can adjust your notification preferences in the 
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/api/email/track/click/{{emailId}}?url=${encodeURIComponent('{{dashboardUrl}}/settings')}">dashboard settings</a>.
          </p>
        </div>
      </div>
    `),
  };

  private static readonly severityColors = {
    info: '#3498db',
    warning: '#f1c40f',
    error: '#e74c3c',
    critical: '#c0392b'
  };

  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  static async processQueue(): Promise<void> {
    try {
      // Process regular notifications
      await this.processRegularNotifications();
      
      // Process digest notifications
      await this.processDigestNotifications();
    } catch (error) {
      console.error('Error processing queue:', error);
    }
  }

  private static async processRegularNotifications(): Promise<void> {
    const queueRef = collection(db, this.EMAIL_QUEUE_COLLECTION);
    const q = query(
      queueRef,
      where('status', '==', 'pending'),
      where('template', '==', 'alert-notification'),
      where('retryCount', '<', this.MAX_RETRIES)
    );

    const snapshot = await getDocs(q);
    const emails = snapshot.docs.slice(0, this.BATCH_SIZE).map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as QueuedEmail[];

    await Promise.all(emails.map(email => this.processEmail(email)));
  }

  private static async processDigestNotifications(): Promise<void> {
    const now = new Date();
    const hourlyTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    const dailyTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Get alerts for digests
    const alertsRef = collection(db, this.ALERTS_COLLECTION);
    const [hourlyAlerts, dailyAlerts] = await Promise.all([
      getDocs(query(
        alertsRef,
        where('timestamp', '>=', hourlyTime),
        orderBy('timestamp', 'desc')
      )),
      getDocs(query(
        alertsRef,
        where('timestamp', '>=', dailyTime),
        orderBy('timestamp', 'desc')
      ))
    ]);

    // Process hourly digests
    if (hourlyAlerts.size > 0) {
      await this.createDigestNotification('hourly', hourlyAlerts.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Alert[]);
    }

    // Process daily digests
    if (dailyAlerts.size > 0) {
      await this.createDigestNotification('daily', dailyAlerts.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Alert[]);
    }
  }

  private static async createDigestNotification(
    period: 'hourly' | 'daily',
    alerts: Alert[]
  ): Promise<void> {
    // Group alerts by user
    const alertsByUser = alerts.reduce((acc, alert) => {
      if (!acc[alert.userId]) {
        acc[alert.userId] = [];
      }
      acc[alert.userId].push(alert);
      return acc;
    }, {} as Record<string, Alert[]>);

    // Create digest notifications for each user
    for (const [userId, userAlerts] of Object.entries(alertsByUser)) {
      // Calculate platform statistics
      const platformStats = userAlerts.reduce((acc, alert) => {
        if (!acc[alert.platform]) {
          acc[alert.platform] = {
            total: 0,
            bySeverity: {}
          };
        }
        acc[alert.platform].total++;
        acc[alert.platform].bySeverity[alert.severity] = 
          (acc[alert.platform].bySeverity[alert.severity] || 0) + 1;
        return acc;
      }, {} as DigestData['platformStats']);

      const digestData: DigestData = {
        alerts: userAlerts,
        period,
        platformStats
      };

      await this.queueDigestEmail(userId, period, digestData);
    }
  }

  private static async queueDigestEmail(
    userId: string,
    period: 'hourly' | 'daily',
    digestData: DigestData
  ): Promise<void> {
    const emailData = {
      ...digestData,
      timeframe: period === 'hourly' ? 'hour' : '24 hours',
      dashboardUrl: process.env.NEXT_PUBLIC_APP_URL,
      getSeverityColor: (severity: string) => this.severityColors[severity],
      formatDate: (date: Date) => new Date(date).toLocaleString()
    };

    const email: Omit<QueuedEmail, 'id'> = {
      to: '', // Will be set from user preferences
      subject: `[Digest] ${period === 'hourly' ? 'Hourly' : 'Daily'} Alert Summary`,
      template: 'alert-digest',
      data: emailData,
      userId,
      createdAt: new Date(),
      status: 'pending'
    };

    try {
      await addDoc(collection(db, this.EMAIL_QUEUE_COLLECTION), email);
    } catch (error) {
      console.error('Error queueing digest email:', error);
    }
  }

  private static async processEmail(email: QueuedEmail): Promise<void> {
    const emailRef = doc(db, this.EMAIL_QUEUE_COLLECTION, email.id);
    const startTime = Date.now();

    try {
      // Mark as processing
      await updateDoc(emailRef, {
        status: 'processing',
        processingStartedAt: Timestamp.now()
      });

      // Get template
      const template = this.emailTemplates[email.template];
      if (!template) {
        throw new Error(`Template ${email.template} not found`);
      }

      // Prepare email data
      const emailData = {
        ...email.data,
        severityColor: this.severityColors[email.data.severity],
        dashboardUrl: process.env.NEXT_PUBLIC_APP_URL,
        timestamp: new Date(email.data.timestamp).toLocaleString()
      };

      // Generate HTML
      const html = template(emailData);

      // Send email
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email.to,
        subject: email.subject,
        html
      });

      const deliveryDuration = Date.now() - startTime;

      // Track successful delivery
      await EmailAnalytics.trackDelivery(
        email.id,
        email.userId,
        email.template === 'alert-digest' ? 
          (email.subject.includes('Hourly') ? 'hourly-digest' : 'daily-digest') : 
          'immediate',
        email.data.platform,
        deliveryDuration
      );

      // Mark as sent
      await updateDoc(emailRef, {
        status: 'sent',
        sentAt: Timestamp.now()
      });
    } catch (error) {
      console.error(`Error processing email ${email.id}:`, error);

      // Track failure
      await EmailAnalytics.trackFailure(
        email.id,
        email.userId,
        email.template === 'alert-digest' ? 
          (email.subject.includes('Hourly') ? 'hourly-digest' : 'daily-digest') : 
          'immediate'
      );

      // Update retry count and status
      await updateDoc(emailRef, {
        status: 'failed',
        error: error.message,
        retryCount: (email.retryCount || 0) + 1,
        lastRetryAt: Timestamp.now()
      });
    }
  }

  static async startWorker(intervalMinutes: number = 1): Promise<() => void> {
    console.log('Starting email worker...');
    
    const processInterval = setInterval(() => {
      this.processQueue().catch(error => {
        console.error('Error in email worker interval:', error);
      });
    }, intervalMinutes * 60 * 1000);

    // Initial processing
    await this.processQueue();

    return () => {
      console.log('Stopping email worker...');
      clearInterval(processInterval);
    };
  }

  static async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    metrics?: AggregatedMetrics;
  }> {
    try {
      const queueRef = collection(db, this.EMAIL_QUEUE_COLLECTION);
      const [pending, processing, sent, failed] = await Promise.all([
        getDocs(query(queueRef, where('status', '==', 'pending'))),
        getDocs(query(queueRef, where('status', '==', 'processing'))),
        getDocs(query(queueRef, where('status', '==', 'sent'))),
        getDocs(query(queueRef, where('status', '==', 'failed')))
      ]);

      // Get metrics for the last 24 hours
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      const metrics = await EmailAnalytics.getMetrics('system', startDate, endDate);

      return {
        pending: pending.size,
        processing: processing.size,
        sent: sent.size,
        failed: failed.size,
        metrics
      };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return { pending: 0, processing: 0, sent: 0, failed: 0 };
    }
  }
} 