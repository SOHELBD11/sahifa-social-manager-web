import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';

interface EmailMetrics {
  emailId: string;
  userId: string;
  type: 'immediate' | 'hourly-digest' | 'daily-digest';
  status: 'delivered' | 'opened' | 'clicked' | 'failed';
  platform?: string;
  deliveryDuration?: number;  // in milliseconds
  openedAt?: Date;
  clickedAt?: Date;
  links?: {
    url: string;
    clickedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

interface AggregatedMetrics {
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  averageDeliveryTime: number;
  byPlatform: {
    [platform: string]: {
      sent: number;
      opened: number;
      clicked: number;
    };
  };
  byType: {
    immediate: number;
    'hourly-digest': number;
    'daily-digest': number;
  };
}

export class EmailAnalytics {
  private static readonly METRICS_COLLECTION = 'email_metrics';
  
  static async trackDelivery(
    emailId: string,
    userId: string,
    type: EmailMetrics['type'],
    platform?: string,
    deliveryDuration?: number
  ): Promise<void> {
    try {
      const metrics: EmailMetrics = {
        emailId,
        userId,
        type,
        status: 'delivered',
        platform,
        deliveryDuration,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, this.METRICS_COLLECTION, emailId), metrics);
    } catch (error) {
      console.error('Error tracking email delivery:', error);
    }
  }

  static async trackOpen(emailId: string): Promise<void> {
    try {
      const metricsRef = doc(db, this.METRICS_COLLECTION, emailId);
      const metricsDoc = await getDoc(metricsRef);

      if (metricsDoc.exists()) {
        await setDoc(metricsRef, {
          status: 'opened',
          openedAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error tracking email open:', error);
    }
  }

  static async trackClick(emailId: string, url: string): Promise<void> {
    try {
      const metricsRef = doc(db, this.METRICS_COLLECTION, emailId);
      const metricsDoc = await getDoc(metricsRef);

      if (metricsDoc.exists()) {
        const metrics = metricsDoc.data() as EmailMetrics;
        const links = metrics.links || [];
        
        links.push({
          url,
          clickedAt: new Date()
        });

        await setDoc(metricsRef, {
          status: 'clicked',
          clickedAt: new Date(),
          links,
          updatedAt: new Date()
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error tracking email click:', error);
    }
  }

  static async trackFailure(emailId: string, userId: string, type: EmailMetrics['type']): Promise<void> {
    try {
      const metrics: EmailMetrics = {
        emailId,
        userId,
        type,
        status: 'failed',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, this.METRICS_COLLECTION, emailId), metrics);
    } catch (error) {
      console.error('Error tracking email failure:', error);
    }
  }

  static async getMetrics(userId: string, startDate?: Date, endDate?: Date): Promise<AggregatedMetrics> {
    try {
      const metricsRef = collection(db, this.METRICS_COLLECTION);
      let metricsQuery = query(metricsRef, where('userId', '==', userId));

      if (startDate) {
        metricsQuery = query(metricsQuery, where('createdAt', '>=', startDate));
      }
      if (endDate) {
        metricsQuery = query(metricsQuery, where('createdAt', '<=', endDate));
      }

      const snapshot = await getDocs(metricsQuery);
      const metrics = snapshot.docs.map(doc => doc.data() as EmailMetrics);

      return this.aggregateMetrics(metrics);
    } catch (error) {
      console.error('Error getting email metrics:', error);
      return this.getEmptyAggregatedMetrics();
    }
  }

  private static aggregateMetrics(metrics: EmailMetrics[]): AggregatedMetrics {
    const aggregated = this.getEmptyAggregatedMetrics();
    let totalDeliveryTime = 0;
    let deliveredCount = 0;

    metrics.forEach(metric => {
      aggregated.totalSent++;
      aggregated.byType[metric.type]++;

      switch (metric.status) {
        case 'delivered':
          aggregated.delivered++;
          if (metric.deliveryDuration) {
            totalDeliveryTime += metric.deliveryDuration;
            deliveredCount++;
          }
          break;
        case 'opened':
          aggregated.opened++;
          break;
        case 'clicked':
          aggregated.clicked++;
          break;
        case 'failed':
          aggregated.failed++;
          break;
      }

      if (metric.platform) {
        if (!aggregated.byPlatform[metric.platform]) {
          aggregated.byPlatform[metric.platform] = {
            sent: 0,
            opened: 0,
            clicked: 0
          };
        }
        aggregated.byPlatform[metric.platform].sent++;
        if (metric.status === 'opened') {
          aggregated.byPlatform[metric.platform].opened++;
        }
        if (metric.status === 'clicked') {
          aggregated.byPlatform[metric.platform].clicked++;
        }
      }
    });

    aggregated.averageDeliveryTime = deliveredCount > 0 
      ? totalDeliveryTime / deliveredCount 
      : 0;

    return aggregated;
  }

  private static getEmptyAggregatedMetrics(): AggregatedMetrics {
    return {
      totalSent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      averageDeliveryTime: 0,
      byPlatform: {},
      byType: {
        immediate: 0,
        'hourly-digest': 0,
        'daily-digest': 0
      }
    };
  }
} 