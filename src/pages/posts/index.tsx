import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import CreatePost from '@/components/posts/CreatePost';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

interface Post {
  id: string;
  content: string;
  platforms: string[];
  mediaUrls: { url: string; type: string }[];
  status: string;
  scheduledFor?: string;
  createdAt: string;
}

export default function Posts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchPosts = async () => {
      try {
        const q = query(
          collection(db, 'posts'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const fetchedPosts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Post[];

        setPosts(fetchedPosts);
      } catch (err) {
        console.error('Error fetching posts:', err);
        setError('Failed to load posts');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Posts</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create and manage your social media posts
            </p>
          </div>
          <button
            onClick={() => setShowCreatePost(!showCreatePost)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {showCreatePost ? 'Hide Create Post' : 'Create New Post'}
          </button>
        </div>

        {showCreatePost && <CreatePost />}

        {loading ? (
          <div>Loading posts...</div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No posts yet. Create your first post!</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {posts.map((post) => (
                <li key={post.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {post.platforms.map((platform) => (
                          <span
                            key={platform}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(post.createdAt)}
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-gray-900">{post.content}</p>
                    </div>
                    {post.mediaUrls && post.mediaUrls.length > 0 && (
                      <div className="mt-2 flex space-x-2">
                        {post.mediaUrls.map((media, index) => (
                          <div key={index} className="h-20 w-20">
                            {media.type === 'image' ? (
                              <img
                                src={media.url}
                                alt="Post media"
                                className="h-full w-full object-cover rounded-lg"
                              />
                            ) : (
                              <video
                                src={media.url}
                                className="h-full w-full object-cover rounded-lg"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${post.status === 'scheduled'
                              ? 'bg-yellow-100 text-yellow-800'
                              : post.status === 'published'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {post.status}
                        </span>
                        {post.scheduledFor && (
                          <span className="ml-2 text-sm text-gray-500">
                            Scheduled for {formatDate(post.scheduledFor)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
} 