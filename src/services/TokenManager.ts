import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { decrypt } from '@/utils/encryption';
import { FacebookAPI } from './facebook/FacebookAPI';
import { InstagramAPI } from './instagram/InstagramAPI';
import { TwitterAPI } from './twitter/TwitterAPI';
import { LinkedInAPI } from './linkedin/LinkedInAPI';

export type Platform = 'facebook' | 'instagram' | 'twitter' | 'linkedin';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class TokenManager {
  private static readonly TOKENS_COLLECTION = 'platform_tokens';

  static async getToken(userId: string, platform: Platform): Promise<TokenData | null> {
    try {
      const tokenDoc = await getDoc(doc(db, this.TOKENS_COLLECTION, `${userId}_${platform}`));
      
      if (!tokenDoc.exists()) {
        return null;
      }

      const data = tokenDoc.data() as TokenData;
      
      // Check if token is expired
      if (data.expiresAt < Date.now()) {
        // Token is expired, try to refresh it
        const newToken = await this.refreshToken(userId, platform, data.refreshToken);
        return newToken;
      }

      return data;
    } catch (error) {
      console.error(`Error getting ${platform} token:`, error);
      return null;
    }
  }

  static async saveToken(
    userId: string,
    platform: Platform,
    tokenData: TokenData
  ): Promise<void> {
    try {
      await setDoc(
        doc(db, this.TOKENS_COLLECTION, `${userId}_${platform}`),
        {
          ...tokenData,
          updatedAt: Date.now(),
        }
      );
    } catch (error) {
      console.error(`Error saving ${platform} token:`, error);
      throw error;
    }
  }

  private static async refreshToken(
    userId: string,
    platform: Platform,
    refreshToken: string
  ): Promise<TokenData | null> {
    try {
      // Implementation will vary by platform
      let newTokenData: TokenData | null = null;

      switch (platform) {
        case 'facebook':
          // Implement Facebook token refresh
          break;
        case 'instagram':
          // Instagram uses Facebook's refresh flow
          break;
        case 'twitter':
          // Implement Twitter token refresh
          break;
        case 'linkedin':
          // Implement LinkedIn token refresh
          break;
      }

      if (newTokenData) {
        await this.saveToken(userId, platform, newTokenData);
        return newTokenData;
      }

      return null;
    } catch (error) {
      console.error(`Error refreshing ${platform} token:`, error);
      return null;
    }
  }

  static async deleteToken(userId: string, platform: Platform): Promise<void> {
    try {
      await setDoc(
        doc(db, this.TOKENS_COLLECTION, `${userId}_${platform}`),
        { deletedAt: Date.now() }
      );
    } catch (error) {
      console.error(`Error deleting ${platform} token:`, error);
      throw error;
    }
  }
} 