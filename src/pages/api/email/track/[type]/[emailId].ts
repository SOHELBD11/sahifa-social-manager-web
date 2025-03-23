import { NextApiRequest, NextApiResponse } from 'next';
import { EmailAnalytics } from '@/services/notifications/EmailAnalytics';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { type, emailId } = req.query;
  
  if (!emailId || typeof emailId !== 'string') {
    return res.status(400).json({ error: 'Invalid email ID' });
  }

  try {
    switch (type) {
      case 'open':
        // Return a 1x1 transparent GIF
        await EmailAnalytics.trackOpen(emailId);
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
        break;

      case 'click':
        const url = req.query.url;
        if (!url || typeof url !== 'string') {
          return res.status(400).json({ error: 'Invalid URL' });
        }
        
        await EmailAnalytics.trackClick(emailId, url);
        res.redirect(307, url);
        break;

      default:
        res.status(400).json({ error: 'Invalid tracking type' });
    }
  } catch (error) {
    console.error('Error tracking email activity:', error);
    if (type === 'open') {
      // Still return the tracking pixel even if tracking fails
      res.setHeader('Content-Type', 'image/gif');
      res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 