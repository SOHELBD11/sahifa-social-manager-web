import { Platform } from './TokenManager';
import { SocialMediaAPI } from './SocialMediaAPI';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffFactor: number;
}

interface RetryableError extends Error {
  isRetryable?: boolean;
  statusCode?: number;
  platform?: Platform;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
};

// Platform-specific retry configurations
const PLATFORM_RETRY_CONFIGS: Record<Platform, RetryConfig> = {
  facebook: {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 5, // Facebook has more rate limits
  },
  instagram: {
    ...DEFAULT_RETRY_CONFIG,
    maxDelay: 60000, // Instagram needs longer delays
  },
  twitter: DEFAULT_RETRY_CONFIG,
  linkedin: {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 4,
  },
};

export class RetryManager {
  private static isRetryableError(error: RetryableError): boolean {
    // If explicitly marked as retryable/non-retryable
    if (typeof error.isRetryable === 'boolean') {
      return error.isRetryable;
    }

    // Check HTTP status codes
    if (error.statusCode) {
      // Retry on rate limits, server errors, and some specific client errors
      return [408, 429, 500, 502, 503, 504].includes(error.statusCode);
    }

    // Platform-specific error handling
    if (error.platform) {
      switch (error.platform) {
        case 'facebook':
          // Retry on Facebook's temporary errors
          return error.message.includes('temporary') || 
                 error.message.includes('rate limit');
        case 'instagram':
          // Retry on Instagram's rate limits and media processing errors
          return error.message.includes('rate limit') || 
                 error.message.includes('media processing');
        case 'twitter':
          // Retry on Twitter's rate limits and server errors
          return error.message.includes('rate limit') || 
                 error.message.includes('server error');
        case 'linkedin':
          // Retry on LinkedIn's rate limits and processing errors
          return error.message.includes('rate limit') || 
                 error.message.includes('processing');
      }
    }

    // Default to not retrying if we can't determine
    return false;
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static getNextDelay(
    currentAttempt: number,
    config: RetryConfig
  ): number {
    const delay = config.initialDelay * Math.pow(config.backoffFactor, currentAttempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  static async retryOperation<T>(
    operation: () => Promise<T>,
    platform: Platform,
    errorContext: { userId: string; postId: string }
  ): Promise<T> {
    const config = PLATFORM_RETRY_CONFIGS[platform];
    let lastError: RetryableError | null = null;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as RetryableError;
        lastError.platform = platform;

        // Log the retry attempt
        console.error(`Attempt ${attempt} failed for ${platform}:`, error);
        await this.logRetryAttempt(errorContext.userId, errorContext.postId, platform, attempt, error);

        // Check if we should retry
        if (attempt === config.maxAttempts || !this.isRetryableError(lastError)) {
          throw lastError;
        }

        // Wait before retrying
        const delay = this.getNextDelay(attempt, config);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  private static async logRetryAttempt(
    userId: string,
    postId: string,
    platform: Platform,
    attempt: number,
    error: any
  ): Promise<void> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        return;
      }

      const retryLogs = postDoc.data().retryLogs || [];
      retryLogs.push({
        platform,
        attempt,
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });

      await updateDoc(postRef, {
        retryLogs,
        lastRetryAttempt: {
          platform,
          attempt,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error logging retry attempt:', error);
      // Don't throw here - we don't want to interrupt the retry process
    }
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    platform: Platform,
    userId: string,
    postId: string
  ): Promise<T> {
    return this.retryOperation(operation, platform, { userId, postId });
  }
} 