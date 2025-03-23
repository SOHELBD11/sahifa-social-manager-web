import { NextApiRequest, NextApiResponse } from 'next';
import { OAuthService } from '@/services/oauth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, error_description);
    return res.redirect(`/connect-account?error=${error}`);
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect('/connect-account?error=invalid_request');
  }

  try {
    await OAuthService.handleCallback(code, state);
    res.redirect('/dashboard?success=true');
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.redirect('/connect-account?error=callback_failed');
  }
} 