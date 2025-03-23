import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { SocialMediaAPI } from './SocialMediaAPI';
import { TokenManager, Platform } from './TokenManager';

interface PostContent {
  content: string;
  mediaUrls: { url: string; type: string }[];
}

export class PostPublisher {
  private static async publishToFacebook(postContent: PostContent, accessToken: string) {
    const api = new SocialMediaAPI('facebook', accessToken);
    let response;

    if (postContent.mediaUrls.length > 0) {
      // Handle media upload first
      const mediaIds = await Promise.all(
        postContent.mediaUrls.map(media => api.uploadMedia(media.url, media.type))
      );
      response = await api.createPost(postContent.content, mediaIds);
    } else {
      response = await api.createPost(postContent.content);
    }

    return response;
  }

  private static async publishToInstagram(postContent: PostContent, accessToken: string) {
    const api = new SocialMediaAPI('instagram', accessToken);
    let response;

    if (postContent.mediaUrls.length > 0) {
      // Instagram requires media for posts
      const mediaId = await api.uploadMedia(postContent.mediaUrls[0].url, postContent.mediaUrls[0].type);
      response = await api.createPost(postContent.content, [mediaId]);
    } else {
      throw new Error('Instagram posts require at least one media item');
    }

    return response;
  }

  private static async publishToTwitter(postContent: PostContent, accessToken: string) {
    const api = new SocialMediaAPI('twitter', accessToken);
    let response;

    if (postContent.mediaUrls.length > 0) {
      const mediaIds = await Promise.all(
        postContent.mediaUrls.map(media => api.uploadMedia(media.url, media.type))
      );
      response = await api.createPost(postContent.content, mediaIds);
    } else {
      response = await api.createPost(postContent.content);
    }

    return response;
  }

  private static async publishToLinkedIn(postContent: PostContent, accessToken: string) {
    const api = new SocialMediaAPI('linkedin', accessToken);
    let response;

    if (postContent.mediaUrls.length > 0) {
      const mediaIds = await Promise.all(
        postContent.mediaUrls.map(media => api.uploadMedia(media.url, media.type))
      );
      response = await api.createPost(postContent.content, mediaIds);
    } else {
      response = await api.createPost(postContent.content);
    }

    return response;
  }

  static async publishPost(userId: string, postId: string, platforms: Platform[], content: PostContent) {
    const results = {
      success: [] as Platform[],
      failed: [] as { platform: Platform; error: string }[],
    };

    for (const platform of platforms) {
      try {
        // Get the access token for the platform from TokenManager
        const accessToken = await TokenManager.getAccessToken(userId, platform);
        
        switch (platform) {
          case 'facebook':
            await this.publishToFacebook(content, accessToken);
            break;
          case 'instagram':
            await this.publishToInstagram(content, accessToken);
            break;
          case 'twitter':
            await this.publishToTwitter(content, accessToken);
            break;
          case 'linkedin':
            await this.publishToLinkedIn(content, accessToken);
            break;
          default:
            throw new Error(`Unsupported platform: ${platform}`);
        }

        results.success.push(platform);
      } catch (error) {
        results.failed.push({
          platform,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    }

    // Update post status in Firestore
    await updateDoc(doc(db, 'posts', postId), {
      status: results.failed.length === 0 ? 'published' : 'partially_published',
      publishResults: results,
      publishedAt: new Date().toISOString(),
    });

    return results;
  }
} 