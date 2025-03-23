import axios from 'axios';

const LINKEDIN_API_URL = 'https://api.linkedin.com/v2';

interface LinkedInMediaResponse {
  value: {
    asset: string;
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string;
      };
    };
  };
}

interface LinkedInShareResponse {
  id: string;
  activity: string;
}

interface LinkedInUserProfile {
  id: string;
  vanityName: string;
}

export class LinkedInAPI {
  private accessToken: string;
  private userId?: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async initialize(): Promise<void> {
    try {
      // Get the user's profile
      const response = await axios.get<LinkedInUserProfile>(
        `${LINKEDIN_API_URL}/me`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      this.userId = response.data.id;
    } catch (error) {
      console.error('Error initializing LinkedIn API:', error);
      throw new Error('Failed to initialize LinkedIn API');
    }
  }

  async uploadImage(url: string): Promise<string> {
    if (!this.userId) {
      throw new Error('LinkedIn API not initialized');
    }

    try {
      // First, register the image upload
      const registerResponse = await axios.post<LinkedInMediaResponse>(
        `${LINKEDIN_API_URL}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: `urn:li:person:${this.userId}`,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Get the upload URL
      const uploadUrl = registerResponse.data.value.uploadMechanism[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ].uploadUrl;

      // Download the image
      const imageResponse = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imageResponse.data, 'binary');

      // Upload the image to LinkedIn's servers
      await axios.put(
        uploadUrl,
        buffer,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/octet-stream',
          },
        }
      );

      return registerResponse.data.value.asset;
    } catch (error) {
      console.error('Error uploading image to LinkedIn:', error);
      throw new Error('Failed to upload image to LinkedIn');
    }
  }

  async uploadVideo(url: string): Promise<string> {
    if (!this.userId) {
      throw new Error('LinkedIn API not initialized');
    }

    try {
      // First, register the video upload
      const registerResponse = await axios.post<LinkedInMediaResponse>(
        `${LINKEDIN_API_URL}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
            owner: `urn:li:person:${this.userId}`,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Get the upload URL
      const uploadUrl = registerResponse.data.value.uploadMechanism[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ].uploadUrl;

      // Download the video
      const videoResponse = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(videoResponse.data, 'binary');

      // Upload the video to LinkedIn's servers
      await axios.put(
        uploadUrl,
        buffer,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/octet-stream',
          },
        }
      );

      return registerResponse.data.value.asset;
    } catch (error) {
      console.error('Error uploading video to LinkedIn:', error);
      throw new Error('Failed to upload video to LinkedIn');
    }
  }

  async createPost(content: string, mediaIds?: string[]): Promise<LinkedInShareResponse> {
    if (!this.userId) {
      throw new Error('LinkedIn API not initialized');
    }

    try {
      const payload: any = {
        author: `urn:li:person:${this.userId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: mediaIds ? 'RICH' : 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      if (mediaIds && mediaIds.length > 0) {
        payload.specificContent['com.linkedin.ugc.ShareContent'].media = mediaIds.map(id => ({
          status: 'READY',
          media: id,
        }));
      }

      const response = await axios.post<LinkedInShareResponse>(
        `${LINKEDIN_API_URL}/ugcPosts`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating LinkedIn post:', error);
      throw new Error('Failed to create LinkedIn post');
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
      };
    } catch (error) {
      console.error('Error refreshing LinkedIn token:', error);
      throw new Error('Failed to refresh LinkedIn access token');
    }
  }
} 