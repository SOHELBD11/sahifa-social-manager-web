import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Alert, AlertSeverity } from '@/services/alerts/AlertManager';

interface NotificationPreferences {
  email: boolean;
  emailAddress: string;
  severityLevels: AlertSeverity[];
  platforms: string[];
  digestFrequency: 'immediate' | 'hourly' | 'daily';
  lastNotificationSent?: Date;
  lastDigestSent?: {
    hourly?: Date;
    daily?: Date;
  };
}

export class NotificationService {
  private static readonly PREFERENCES_COLLECTION = 'notification_preferences';
  private static readonly EMAIL_QUEUE_COLLECTION = 'email_queue';

  static async getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const prefsDoc = await getDoc(doc(db, this.PREFERENCES_COLLECTION, userId));
      return prefsDoc.exists() ? prefsDoc.data() as NotificationPreferences : null;
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return null;
    }
  }

  static async updateNotificationPreferences(
    userId: string,
    preferences: NotificationPreferences
  ): Promise<void> {
    try {
      await setDoc(
        doc(db, this.PREFERENCES_COLLECTION, userId),
        {
          ...preferences,
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  static async queueEmailNotification(
    userId: string,
    alert: Alert,
    preferences: NotificationPreferences
  ): Promise<void> {
    // Skip if email notifications are disabled or severity level is not included
    if (!preferences.email || !preferences.severityLevels.includes(alert.severity)) {
      return;
    }

    // Skip if platform is not included in preferences
    if (!preferences.platforms.includes(alert.platform)) {
      return;
    }

    // For immediate notifications, queue them directly
    if (preferences.digestFrequency === 'immediate') {
      try {
        const emailData = {
          to: preferences.emailAddress,
          subject: `[${alert.severity.toUpperCase()}] Alert for ${alert.platform}`,
          template: 'alert-notification',
          data: {
            alertId: alert.id,
            platform: alert.platform,
            message: alert.message,
            severity: alert.severity,
            metric: alert.metric,
            value: alert.value,
            threshold: alert.threshold,
            timestamp: alert.timestamp,
          },
          userId,
          createdAt: new Date(),
          status: 'pending',
        };

        await setDoc(
          doc(db, this.EMAIL_QUEUE_COLLECTION, `${alert.id}_${userId}`),
          emailData
        );

        // Update last notification sent timestamp
        await this.updateLastNotificationSent(userId);
      } catch (error) {
        console.error('Error queueing email notification:', error);
      }
    }
    // For digest notifications, the EmailWorker will handle them
  }

  static async updateLastNotificationSent(
    userId: string,
    digestType?: 'hourly' | 'daily'
  ): Promise<void> {
    try {
      const update: any = {
        lastNotificationSent: new Date(),
      };

      if (digestType) {
        update[`lastDigestSent.${digestType}`] = new Date();
      }

      await setDoc(
        doc(db, this.PREFERENCES_COLLECTION, userId),
        update,
        { merge: true }
      );
    } catch (error) {
      console.error('Error updating last notification sent:', error);
    }
  }

  static async shouldSendDigest(
    userId: string,
    digestType: 'hourly' | 'daily'
  ): Promise<boolean> {
    try {
      const preferences = await this.getNotificationPreferences(userId);
      if (!preferences || !preferences.email) return false;
      if (preferences.digestFrequency !== digestType) return false;

      const lastSent = preferences.lastDigestSent?.[digestType];
      if (!lastSent) return true;

      const now = new Date();
      const lastSentDate = new Date(lastSent);
      const hoursSinceLastSent = (now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60);

      switch (digestType) {
        case 'hourly':
          return hoursSinceLastSent >= 1;
        case 'daily':
          return hoursSinceLastSent >= 24;
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking digest status:', error);
      return false;
    }
  }

  static async initializeDefaultPreferences(userId: string, email: string): Promise<void> {
    const defaultPreferences: NotificationPreferences = {
      email: true,
      emailAddress: email,
      severityLevels: ['error', 'critical'],
      platforms: ['facebook', 'instagram', 'twitter', 'linkedin'],
      digestFrequency: 'immediate',
    };

    try {
      const prefsDoc = await getDoc(doc(db, this.PREFERENCES_COLLECTION, userId));
      
      if (!prefsDoc.exists()) {
        await this.updateNotificationPreferences(userId, defaultPreferences);
      }
    } catch (error) {
      console.error('Error initializing notification preferences:', error);
    }
  }
} 