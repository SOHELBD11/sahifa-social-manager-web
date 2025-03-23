import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, increment, Timestamp } from 'firebase/firestore';

interface RateLimitConfig {
  windowSize: number;      // Time window in milliseconds
  maxRequests: number;     // Maximum requests allowed in window
  userId: string;
  type: 'email' | 'notification' | 'alert';
}

interface RateLimitRecord {
  userId: string;
  type: string;
  count: number;
  windowStart: Date;
  lastUpdated: Date;
}

export class RateLimiter {
  private static readonly RATE_LIMIT_COLLECTION = 'rate_limits';
  
  private static readonly DEFAULT_LIMITS = {
    email: {
      windowSize: 3600000,    // 1 hour in milliseconds
      maxRequests: 100        // 100 emails per hour
    },
    notification: {
      windowSize: 300000,     // 5 minutes in milliseconds
      maxRequests: 50         // 50 notifications per 5 minutes
    },
    alert: {
      windowSize: 60000,      // 1 minute in milliseconds
      maxRequests: 10         // 10 alerts per minute
    }
  };

  static async isRateLimited(config: RateLimitConfig): Promise<boolean> {
    try {
      const recordId = `${config.userId}_${config.type}`;
      const recordRef = doc(db, this.RATE_LIMIT_COLLECTION, recordId);
      const record = await getDoc(recordRef);

      const now = new Date();
      const defaultLimit = this.DEFAULT_LIMITS[config.type];
      const windowSize = config.windowSize || defaultLimit.windowSize;
      const maxRequests = config.maxRequests || defaultLimit.maxRequests;

      if (!record.exists()) {
        // Create new record
        await setDoc(recordRef, {
          userId: config.userId,
          type: config.type,
          count: 1,
          windowStart: now,
          lastUpdated: now
        });
        return false;
      }

      const data = record.data() as RateLimitRecord;
      const windowStart = data.windowStart.toDate();
      const timeSinceStart = now.getTime() - windowStart.getTime();

      if (timeSinceStart > windowSize) {
        // Window expired, reset counter
        await setDoc(recordRef, {
          userId: config.userId,
          type: config.type,
          count: 1,
          windowStart: now,
          lastUpdated: now
        });
        return false;
      }

      if (data.count >= maxRequests) {
        return true; // Rate limited
      }

      // Increment counter
      await setDoc(recordRef, {
        count: increment(1),
        lastUpdated: now
      }, { merge: true });

      return false;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return false; // Fail open to prevent blocking legitimate traffic
    }
  }

  static async getRateLimitStatus(userId: string, type: RateLimitConfig['type']): Promise<{
    remaining: number;
    resetTime: Date;
    isLimited: boolean;
  }> {
    try {
      const recordId = `${userId}_${type}`;
      const recordRef = doc(db, this.RATE_LIMIT_COLLECTION, recordId);
      const record = await getDoc(recordRef);

      const now = new Date();
      const defaultLimit = this.DEFAULT_LIMITS[type];

      if (!record.exists()) {
        return {
          remaining: defaultLimit.maxRequests,
          resetTime: new Date(now.getTime() + defaultLimit.windowSize),
          isLimited: false
        };
      }

      const data = record.data() as RateLimitRecord;
      const windowStart = data.windowStart.toDate();
      const timeSinceStart = now.getTime() - windowStart.getTime();

      if (timeSinceStart > defaultLimit.windowSize) {
        return {
          remaining: defaultLimit.maxRequests,
          resetTime: new Date(now.getTime() + defaultLimit.windowSize),
          isLimited: false
        };
      }

      const remaining = Math.max(0, defaultLimit.maxRequests - data.count);
      const resetTime = new Date(windowStart.getTime() + defaultLimit.windowSize);

      return {
        remaining,
        resetTime,
        isLimited: remaining === 0
      };
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return {
        remaining: 0,
        resetTime: new Date(),
        isLimited: true
      };
    }
  }

  static async clearRateLimit(userId: string, type: RateLimitConfig['type']): Promise<void> {
    try {
      const recordId = `${userId}_${type}`;
      const recordRef = doc(db, this.RATE_LIMIT_COLLECTION, recordId);
      
      await setDoc(recordRef, {
        userId,
        type,
        count: 0,
        windowStart: new Date(),
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error clearing rate limit:', error);
    }
  }
} 