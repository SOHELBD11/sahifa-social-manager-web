import { FacebookAPI } from './facebook/FacebookAPI';
import { InstagramAPI } from './instagram/InstagramAPI';
import { TwitterAPI } from './twitter/TwitterAPI';
import { LinkedInAPI } from './linkedin/LinkedInAPI';
import { RetryManager } from './RetryManager';
import { PostAnalytics } from './analytics/PostAnalytics';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'linkedin';

export class SocialMediaAPI {
  private platform: Platform;
  private accessToken: string;
  private userId: string;
  private facebookApi?: FacebookAPI;
  private instagramApi?: InstagramAPI;
  private twitterApi?: TwitterAPI;
  private linkedInApi?: LinkedInAPI;

  constructor(platform: Platform, accessToken: string, userId: string) {
    this.platform = platform;
    this.accessToken = accessToken;
    this.userId = userId;
  }

  private async initializePlatformApi(): Promise<void> {
    switch (this.platform) {
      case 'facebook':
        this.facebookApi = new FacebookAPI(this.accessToken);
        await this.facebookApi.initialize();
        break;
      case 'instagram':
        this.instagramApi = new InstagramAPI(this.accessToken);
        await this.instagramApi.initialize();
        break;
      case 'twitter':
        this.twitterApi = new TwitterAPI(this.accessToken);
        break;
      case 'linkedin':
        this.linkedInApi = new LinkedInAPI(this.accessToken);
        await this.linkedInApi.initialize();
        break;
    }
  }

  async uploadMedia(url: string, type: string, postId: string): Promise<string> {
    await this.initializePlatformApi();

    const startTime = Date.now();
    let mediaId: string;
    let retryCount = 0;
    let error: Error | null = null;

    try {
      const uploadOperation = async () => {
        switch (this.platform) {
          case 'facebook':
            if (!this.facebookApi) throw new Error('Facebook API not initialized');
            return type === 'video' 
              ? await this.facebookApi.uploadVideo(url)
              : await this.facebookApi.uploadPhoto(url);

          case 'instagram':
            if (!this.instagramApi) throw new Error('Instagram API not initialized');
            return await this.instagramApi.uploadMedia(url, type);

          case 'twitter':
            if (!this.twitterApi) throw new Error('Twitter API not initialized');
            return await this.twitterApi.uploadMedia(url, type);

          case 'linkedin':
            if (!this.linkedInApi) throw new Error('LinkedIn API not initialized');
            return type === 'video'
              ? await this.linkedInApi.uploadVideo(url)
              : await this.linkedInApi.uploadImage(url);

          default:
            throw new Error(`${this.platform} API not implemented yet`);
        }
      };

      mediaId = await RetryManager.withRetry(
        uploadOperation,
        this.platform,
        this.userId,
        postId
      );

      // Get retry count from RetryManager logs
      const postDoc = await getDoc(doc(db, 'posts', postId));
      if (postDoc.exists()) {
        retryCount = (postDoc.data().retryLogs || []).length;
      }
    } catch (e) {
      error = e as Error;
      throw error;
    } finally {
      // Log media upload metrics
      await PostAnalytics.logPostMetrics(this.userId, postId, {
        publishDuration: 0, // Will be updated when post is published
        mediaUploadDuration: Date.now() - startTime,
        retryCount,
        mediaCount: 1,
        status: error ? 'failed' : 'success',
        errorCode: error?.message,
        platform: this.platform,
      });
    }

    return mediaId!;
  }

  async createPost(content: string, mediaIds: string[] | undefined, postId: string): Promise<any> {
    await this.initializePlatformApi();

    const startTime = Date.now();
    let result: any;
    let retryCount = 0;
    let error: Error | null = null;

    try {
      const postOperation = async () => {
        switch (this.platform) {
          case 'facebook':
            if (!this.facebookApi) throw new Error('Facebook API not initialized');
            return await this.facebookApi.createPost(content, mediaIds);

          case 'instagram':
            if (!this.instagramApi) throw new Error('Instagram API not initialized');
            if (!mediaIds || mediaIds.length === 0) {
              throw new Error('Instagram requires at least one media item');
            }
            // Instagram only supports one media item per post
            return await this.instagramApi.createPost(mediaIds[0]);

          case 'twitter':
            if (!this.twitterApi) throw new Error('Twitter API not initialized');
            return await this.twitterApi.createPost(content, mediaIds);

          case 'linkedin':
            if (!this.linkedInApi) throw new Error('LinkedIn API not initialized');
            return await this.linkedInApi.createPost(content, mediaIds);

          default:
            throw new Error(`${this.platform} API not implemented yet`);
        }
      };

      result = await RetryManager.withRetry(
        postOperation,
        this.platform,
        this.userId,
        postId
      );

      // Get retry count from RetryManager logs
      const postDoc = await getDoc(doc(db, 'posts', postId));
      if (postDoc.exists()) {
        retryCount = (postDoc.data().retryLogs || []).length;
      }
    } catch (e) {
      error = e as Error;
      throw error;
    } finally {
      // Log post metrics
      await PostAnalytics.logPostMetrics(this.userId, postId, {
        publishDuration: Date.now() - startTime,
        mediaUploadDuration: 0, // Already logged during media upload
        retryCount,
        mediaCount: mediaIds?.length || 0,
        status: error ? 'failed' : 'success',
        errorCode: error?.message,
        platform: this.platform,
      });
    }

    return result;
  }
} 