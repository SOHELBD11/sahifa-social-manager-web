import { oauthConfig } from '@/config/oauth';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { generatePKCEChallenge } from '@/utils/pkce';

interface OAuthState {
  platform: string;
  userId: string;
  verifier?: string;
}

export class OAuthService {
  private static generateState(platform: string, userId: string, verifier?: string): string {
    const state: OAuthState = { platform, userId, verifier };
    return btoa(JSON.stringify(state));
  }

  private static parseState(state: string): OAuthState {
    try {
      return JSON.parse(atob(state));
    } catch (error) {
      throw new Error('Invalid state parameter');
    }
  }

  static async initiateOAuth(platform: string, userId: string): Promise<string> {
    const config = oauthConfig[platform as keyof typeof oauthConfig];
    if (!config) throw new Error(`Unsupported platform: ${platform}`);

    const clientId = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID_[platform.toUpperCase()];
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`;

    let state = '';
    let authUrl = new URL(config.authUrl);

    // Add common parameters
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', config.responseType);
    authUrl.searchParams.append('scope', config.scope.join(' '));

    // Handle PKCE for platforms that require it (e.g., Twitter)
    if (config.codeChallenge) {
      const { verifier, challenge } = await generatePKCEChallenge();
      state = this.generateState(platform, userId, verifier);
      authUrl.searchParams.append('code_challenge', challenge);
      authUrl.searchParams.append('code_challenge_method', config.codeChallengeMethod);
    } else {
      state = this.generateState(platform, userId);
    }

    authUrl.searchParams.append('state', state);

    // Platform-specific parameters
    if (platform === 'facebook') {
      authUrl.searchParams.append('auth_type', 'rerequest');
    }

    return authUrl.toString();
  }

  static async handleCallback(code: string, state: string): Promise<void> {
    const { platform, userId, verifier } = this.parseState(state);
    const config = oauthConfig[platform as keyof typeof oauthConfig];
    
    try {
      // Create a pending social account
      const accountRef = await addDoc(collection(db, 'socialAccounts'), {
        userId,
        platform,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      // Exchange the code for access token (this will be handled by the API)
      const response = await fetch('/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, platform, verifier }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const { accessToken, profile } = await response.json();

      // Update the social account with the profile information
      await updateDoc(doc(db, 'socialAccounts', accountRef.id), {
        status: 'active',
        username: profile.username,
        profileId: profile.id,
        accessToken, // Note: In production, store this securely
        updatedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error in OAuth callback:', error);
      throw error;
    }
  }
} 