import * as functions from 'firebase-functions';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { PostPublisher } from '../services/PostPublisher';
import { Platform } from '../services/TokenManager';

export const publishScheduledPosts = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    try {
      // Query for scheduled posts that are due
      const q = query(
        collection(db, 'posts'),
        where('status', '==', 'scheduled'),
        where('scheduledFor', '>=', fiveMinutesAgo.toISOString()),
        where('scheduledFor', '<=', now.toISOString())
      );

      const querySnapshot = await getDocs(q);
      const publishPromises: Promise<any>[] = [];

      querySnapshot.forEach((doc) => {
        const post = doc.data();
        const publishPromise = PostPublisher.publishPost(
          post.userId,
          doc.id,
          post.platforms as Platform[],
          {
            content: post.content,
            mediaUrls: post.mediaUrls || [],
          }
        );
        publishPromises.push(publishPromise);
      });

      // Wait for all posts to be published
      const results = await Promise.allSettled(publishPromises);

      // Log results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Published ${successful} posts successfully, ${failed} failed`);
      
      return null;
    } catch (error) {
      console.error('Error publishing scheduled posts:', error);
      throw error;
    }
  }); 