import axios from 'axios';

const INSTAGRAM_API_VERSION = 'v18.0';
const INSTAGRAM_GRAPH_URL = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}`;

interface InstagramMediaResponse {
  id: string;
  status_code?: string;
}

interface InstagramPostResponse {
  id: string;
  permalink?: string;
}

export class InstagramAPI {
  private accessToken: string;
  private instagramAccountId?: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async initialize(): Promise<void> {
    try {
      // Get the user's Instagram business account
      const response = await axios.get(`${INSTAGRAM_GRAPH_URL}/me/accounts`, {
        params: { access_token: this.accessToken }
      });

      if (response.data.data && response.data.data.length > 0) {
        // Get Instagram account ID for the first page
        const pageId = response.data.data[0].id;
        const igResponse = await axios.get(`${INSTAGRAM_GRAPH_URL}/${pageId}`, {
          params: {
            fields: 'instagram_business_account',
            access_token: this.accessToken
          }
        });

        if (igResponse.data.instagram_business_account) {
          this.instagramAccountId = igResponse.data.instagram_business_account.id;
        } else {
          throw new Error('No Instagram business account found');
        }
      } else {
        throw new Error('No Facebook pages found for this user');
      }
    } catch (error) {
      console.error('Error initializing Instagram API:', error);
      throw new Error('Failed to initialize Instagram API');
    }
  }

  async uploadMedia(url: string, type: string, caption?: string): Promise<string> {
    if (!this.instagramAccountId) {
      throw new Error('Instagram API not initialized');
    }

    try {
      // First, create a container
      const containerResponse = await axios.post<InstagramMediaResponse>(
        `${INSTAGRAM_GRAPH_URL}/${this.instagramAccountId}/media`,
        null,
        {
          params: {
            image_url: type === 'image' ? url : undefined,
            video_url: type === 'video' ? url : undefined,
            caption,
            access_token: this.accessToken
          }
        }
      );

      const mediaId = containerResponse.data.id;

      // For videos, we need to check the status
      if (type === 'video') {
        await this.waitForVideoProcessing(mediaId);
      }

      return mediaId;
    } catch (error) {
      console.error('Error uploading media to Instagram:', error);
      throw new Error('Failed to upload media to Instagram');
    }
  }

  private async waitForVideoProcessing(mediaId: string): Promise<void> {
    const maxAttempts = 10;
    const delayMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(`${INSTAGRAM_GRAPH_URL}/${mediaId}`, {
          params: {
            fields: 'status_code',
            access_token: this.accessToken
          }
        });

        if (response.data.status_code === 'FINISHED') {
          return;
        } else if (response.data.status_code === 'ERROR') {
          throw new Error('Video processing failed');
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error) {
        console.error('Error checking video status:', error);
        throw new Error('Failed to check video processing status');
      }
    }

    throw new Error('Video processing timeout');
  }

  async createPost(mediaId: string): Promise<InstagramPostResponse> {
    if (!this.instagramAccountId) {
      throw new Error('Instagram API not initialized');
    }

    try {
      const response = await axios.post<InstagramPostResponse>(
        `${INSTAGRAM_GRAPH_URL}/${this.instagramAccountId}/media_publish`,
        null,
        {
          params: {
            creation_id: mediaId,
            access_token: this.accessToken
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error publishing Instagram post:', error);
      throw new Error('Failed to publish Instagram post');
    }
  }

  // Instagram uses the same token refresh mechanism as Facebook
  async refreshLongLivedToken(accessToken: string): Promise<string> {
    try {
      const response = await axios.get(`${INSTAGRAM_GRAPH_URL}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          fb_exchange_token: accessToken
        }
      });

      return response.data.access_token;
    } catch (error) {
      console.error('Error refreshing Instagram token:', error);
      throw new Error('Failed to refresh Instagram access token');
    }
  }
} 