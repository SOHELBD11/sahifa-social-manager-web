import { db } from '@/lib/firebase';
import { doc, collection, addDoc, updateDoc, increment, getDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { Platform } from '@/services/TokenManager';

interface PostMetrics {
  publishDuration: number;  // Time taken to publish in ms
  retryCount: number;      // Number of retries needed
  mediaCount: number;      // Number of media items
  mediaUploadDuration: number; // Time taken to upload media in ms
  status: 'success' | 'failed' | 'partial_success';
  errorCode?: string;      // Error code if failed
  platform: Platform;      // Social media platform
}

interface PlatformMetrics {
  totalPosts: number;
  successfulPosts: number;
  failedPosts: number;
  totalRetries: number;
  avgPublishDuration: number;
  avgMediaUploadDuration: number;
  commonErrors: { [key: string]: number };
}

interface PerformanceMetrics {
  avgPublishDuration: number;
  avgMediaUploadDuration: number;
  successRate: number;
}

export class PostAnalytics {
  private static readonly ANALYTICS_COLLECTION = 'post_analytics';
  private static readonly ERROR_COLLECTION = 'post_errors';

  private static async updatePlatformMetrics(
    userId: string,
    platform: Platform,
    metrics: PostMetrics
  ): Promise<void> {
    const platformMetricsRef = doc(db, 'users', userId, 'platformMetrics', platform);
    const platformMetricsDoc = await getDoc(platformMetricsRef);

    if (!platformMetricsDoc.exists()) {
      // Initialize metrics if they don't exist
      await updateDoc(platformMetricsRef, {
        totalPosts: 1,
        successfulPosts: metrics.status === 'success' ? 1 : 0,
        failedPosts: metrics.status === 'failed' ? 1 : 0,
        totalRetries: metrics.retryCount,
        avgPublishDuration: metrics.publishDuration,
        avgMediaUploadDuration: metrics.mediaUploadDuration,
        commonErrors: metrics.errorCode ? { [metrics.errorCode]: 1 } : {},
        lastUpdated: new Date().toISOString(),
      });
    } else {
      const currentMetrics = platformMetricsDoc.data() as PlatformMetrics;
      const totalPosts = currentMetrics.totalPosts + 1;

      // Calculate new averages
      const newAvgPublishDuration = (
        (currentMetrics.avgPublishDuration * currentMetrics.totalPosts + metrics.publishDuration) /
        totalPosts
      );
      const newAvgMediaUploadDuration = (
        (currentMetrics.avgMediaUploadDuration * currentMetrics.totalPosts + metrics.mediaUploadDuration) /
        totalPosts
      );

      // Update error counts
      const commonErrors = { ...currentMetrics.commonErrors };
      if (metrics.errorCode) {
        commonErrors[metrics.errorCode] = (commonErrors[metrics.errorCode] || 0) + 1;
      }

      await updateDoc(platformMetricsRef, {
        totalPosts: increment(1),
        successfulPosts: increment(metrics.status === 'success' ? 1 : 0),
        failedPosts: increment(metrics.status === 'failed' ? 1 : 0),
        totalRetries: increment(metrics.retryCount),
        avgPublishDuration: newAvgPublishDuration,
        avgMediaUploadDuration: newAvgMediaUploadDuration,
        commonErrors,
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  static async logPostMetrics(
    userId: string,
    platform: Platform,
    metrics: {
      publishDuration: number;
      mediaUploadDuration: number;
      success: boolean;
    }
  ): Promise<void> {
    try {
      const analyticsRef = doc(db, this.ANALYTICS_COLLECTION, `${userId}_${platform}`);
      const analyticsDoc = await getDoc(analyticsRef);

      const currentData = analyticsDoc.exists() ? analyticsDoc.data() : {
        totalPosts: 0,
        successfulPosts: 0,
        totalPublishDuration: 0,
        totalMediaUploadDuration: 0,
      };

      const newData = {
        totalPosts: currentData.totalPosts + 1,
        successfulPosts: currentData.successfulPosts + (metrics.success ? 1 : 0),
        totalPublishDuration: currentData.totalPublishDuration + metrics.publishDuration,
        totalMediaUploadDuration: currentData.totalMediaUploadDuration + metrics.mediaUploadDuration,
        avgPublishDuration: (currentData.totalPublishDuration + metrics.publishDuration) / (currentData.totalPosts + 1),
        avgMediaUploadDuration: (currentData.totalMediaUploadDuration + metrics.mediaUploadDuration) / (currentData.totalPosts + 1),
        successRate: ((currentData.successfulPosts + (metrics.success ? 1 : 0)) / (currentData.totalPosts + 1)) * 100,
        lastUpdated: new Date(),
      };

      await setDoc(analyticsRef, newData);
    } catch (error) {
      console.error('Error logging post metrics:', error);
    }
  }

  static async getPostMetrics(userId: string, postId: string): Promise<PostMetrics | null> {
    try {
      const postDoc = await getDoc(doc(db, 'posts', postId));
      if (!postDoc.exists() || !postDoc.data().metrics) {
        return null;
      }
      return postDoc.data().metrics as PostMetrics;
    } catch (error) {
      console.error('Error retrieving post metrics:', error);
      return null;
    }
  }

  static async getPlatformMetrics(
    userId: string,
    platform: Platform
  ): Promise<PlatformMetrics | null> {
    try {
      const metricsDoc = await getDoc(doc(db, 'users', userId, 'platformMetrics', platform));
      if (!metricsDoc.exists()) {
        return null;
      }
      return metricsDoc.data() as PlatformMetrics;
    } catch (error) {
      console.error('Error retrieving platform metrics:', error);
      return null;
    }
  }

  static async getErrorAnalysis(
    userId: string,
    platform: Platform
  ): Promise<{ [key: string]: number }> {
    try {
      const errorsRef = collection(db, this.ERROR_COLLECTION);
      const q = query(
        errorsRef,
        where('userId', '==', userId),
        where('platform', '==', platform)
      );
      const querySnapshot = await getDocs(q);

      const errorCounts: { [key: string]: number } = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const errorType = data.errorType;
        errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
      });

      return errorCounts;
    } catch (error) {
      console.error('Error fetching error analysis:', error);
      return {};
    }
  }

  static async getPerformanceMetrics(
    userId: string,
    platform: Platform
  ): Promise<PerformanceMetrics | null> {
    try {
      const analyticsRef = doc(db, this.ANALYTICS_COLLECTION, `${userId}_${platform}`);
      const analyticsDoc = await getDoc(analyticsRef);

      if (!analyticsDoc.exists()) {
        return null;
      }

      const data = analyticsDoc.data();
      return {
        avgPublishDuration: data.avgPublishDuration || 0,
        avgMediaUploadDuration: data.avgMediaUploadDuration || 0,
        successRate: data.successRate || 0,
      };
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return null;
    }
  }

  static async logError(
    userId: string,
    platform: Platform,
    errorType: string,
    errorDetails: string
  ): Promise<void> {
    try {
      const errorsRef = collection(db, this.ERROR_COLLECTION);
      await errorsRef.add({
        userId,
        platform,
        errorType,
        errorDetails,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error logging post error:', error);
    }
  }
} 