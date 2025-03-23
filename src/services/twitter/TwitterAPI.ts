import axios from 'axios';

const TWITTER_API_URL = 'https://api.twitter.com/2';
const TWITTER_UPLOAD_API_URL = 'https://upload.twitter.com/1.1/media/upload.json';

interface TwitterMediaResponse {
  media_id_string: string;
  processing_info?: {
    state: string;
    check_after_secs?: number;
  };
}

interface TwitterPostResponse {
  data: {
    id: string;
    text: string;
  };
}

export class TwitterAPI {
  private accessToken: string;
  private uploadAccessToken: string; // v1.1 API requires a different token format

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    // Convert Bearer token to v1.1 OAuth format if needed
    this.uploadAccessToken = accessToken.startsWith('Bearer ') 
      ? accessToken.substring(7) 
      : accessToken;
  }

  async uploadMedia(url: string, type: string): Promise<string> {
    try {
      // First, download the media file
      const mediaResponse = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(mediaResponse.data, 'binary');

      // Initialize upload
      const initResponse = await axios.post<TwitterMediaResponse>(
        TWITTER_UPLOAD_API_URL,
        null,
        {
          params: {
            command: 'INIT',
            total_bytes: buffer.length,
            media_type: this.getMediaType(type),
          },
          headers: {
            Authorization: `OAuth ${this.uploadAccessToken}`,
          },
        }
      );

      const mediaId = initResponse.data.media_id_string;

      // Upload media in chunks
      const chunkSize = 1024 * 1024; // 1MB chunks
      for (let i = 0; i < buffer.length; i += chunkSize) {
        const chunk = buffer.slice(i, i + chunkSize);
        await axios.post(
          TWITTER_UPLOAD_API_URL,
          null,
          {
            params: {
              command: 'APPEND',
              media_id: mediaId,
              segment_index: Math.floor(i / chunkSize),
              media_data: chunk.toString('base64'),
            },
            headers: {
              Authorization: `OAuth ${this.uploadAccessToken}`,
            },
          }
        );
      }

      // Finalize upload
      const finalizeResponse = await axios.post<TwitterMediaResponse>(
        TWITTER_UPLOAD_API_URL,
        null,
        {
          params: {
            command: 'FINALIZE',
            media_id: mediaId,
          },
          headers: {
            Authorization: `OAuth ${this.uploadAccessToken}`,
          },
        }
      );

      // Check if we need to wait for processing
      if (finalizeResponse.data.processing_info) {
        await this.waitForMediaProcessing(mediaId);
      }

      return mediaId;
    } catch (error) {
      console.error('Error uploading media to Twitter:', error);
      throw new Error('Failed to upload media to Twitter');
    }
  }

  private async waitForMediaProcessing(mediaId: string): Promise<void> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get<TwitterMediaResponse>(
          TWITTER_UPLOAD_API_URL,
          {
            params: {
              command: 'STATUS',
              media_id: mediaId,
            },
            headers: {
              Authorization: `OAuth ${this.uploadAccessToken}`,
            },
          }
        );

        const state = response.data.processing_info?.state;

        if (state === 'succeeded') {
          return;
        } else if (state === 'failed') {
          throw new Error('Media processing failed');
        }

        // Wait for the recommended time or default to 5 seconds
        const waitTime = (response.data.processing_info?.check_after_secs || 5) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        attempts++;
      } catch (error) {
        console.error('Error checking media status:', error);
        throw new Error('Failed to check media processing status');
      }
    }

    throw new Error('Media processing timeout');
  }

  private getMediaType(type: string): string {
    switch (type.toLowerCase()) {
      case 'image':
        return 'image/jpeg';
      case 'video':
        return 'video/mp4';
      case 'gif':
        return 'image/gif';
      default:
        throw new Error(`Unsupported media type: ${type}`);
    }
  }

  async createPost(content: string, mediaIds?: string[]): Promise<TwitterPostResponse> {
    try {
      const payload: any = {
        text: content,
      };

      if (mediaIds && mediaIds.length > 0) {
        payload.media = {
          media_ids: mediaIds,
        };
      }

      const response = await axios.post<TwitterPostResponse>(
        `${TWITTER_API_URL}/tweets`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating Twitter post:', error);
      throw new Error('Failed to create Twitter post');
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const response = await axios.post(
        'https://api.twitter.com/2/oauth2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.TWITTER_CLIENT_ID!,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          auth: {
            username: process.env.TWITTER_CLIENT_ID!,
            password: process.env.TWITTER_CLIENT_SECRET!,
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
      };
    } catch (error) {
      console.error('Error refreshing Twitter token:', error);
      throw new Error('Failed to refresh Twitter access token');
    }
  }
} 