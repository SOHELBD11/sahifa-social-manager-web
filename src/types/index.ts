// Platform types
export type Platform = 'facebook' | 'instagram' | 'twitter' | 'linkedin';

// Alert types
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface MonitoringAlert {
  id: string;
  userId: string;
  message: string;
  severity: AlertSeverity;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  platform?: Platform;
  type: string;
  data?: Record<string, any>;
}

// Analytics types
export interface AggregatedMetrics {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  byPlatform: Record<Platform, {
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  }>;
  byDate: Record<string, {
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
  }>;
}

// Notification types
export interface NotificationPreferences {
  email: boolean;
  emailAddress: string;
  severityLevels: AlertSeverity[];
  platforms: Platform[];
  digestFrequency: 'immediate' | 'hourly' | 'daily';
}

// Report types
export interface ReportTemplate {
  id: string;
  userId: string;
  name: string;
  description: string;
  format: 'csv' | 'json';
  includeMetrics: boolean;
  metrics: {
    deliveryRate: boolean;
    openRate: boolean;
    clickRate: boolean;
    bounceRate: boolean;
    engagementScore: boolean;
  };
  includeAlerts: boolean;
  includePlatformData: boolean;
  emailSubject: string;
  emailBody: string;
  createdAt: Date;
  updatedAt: Date;
}

// API types
export interface SocialMediaPost {
  content: string;
  mediaUrls?: Array<{
    url: string;
    type: string;
  }>;
  platform: Platform;
  scheduledTime?: Date;
}

export interface PostMetrics {
  impressions: number;
  engagements: number;
  clicks: number;
  shares: number;
  comments: number;
  likes: number;
  platform: Platform;
  timestamp: Date;
}

// Service types
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  platform: Platform;
  userId: string;
}

export interface RateLimitConfig {
  windowSize: number; // in milliseconds
  maxRequests: number;
}

export interface RateLimitRecord {
  userId: string;
  type: string;
  windowStart: Date;
  requestCount: number;
}

export interface RateLimitStatus {
  isLimited: boolean;
  remainingRequests: number;
  resetTime: Date;
}

// Firebase types
export interface FirestoreTimestamp {
  toDate(): Date;
  seconds: number;
  nanoseconds: number;
} 