import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OAuthService } from '@/services/oauth';
import { useRouter } from 'next/router';

interface Platform {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const platforms: Platform[] = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '/icons/facebook.svg',
    description: 'Connect your Facebook pages and profile'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '/icons/instagram.svg',
    description: 'Connect your Instagram business account'
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: '/icons/twitter.svg',
    description: 'Connect your Twitter profile'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '/icons/linkedin.svg',
    description: 'Connect your LinkedIn profile or pages'
  }
];

export default function ConnectAccount() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle error from OAuth callback
  useEffect(() => {
    const { error: oauthError } = router.query;
    if (oauthError) {
      setError('Failed to connect account. Please try again.');
    }
  }, [router.query]);

  const handleConnect = async (platform: Platform) => {
    if (!user) return;
    
    setLoading(platform.id);
    setError(null);

    try {
      const authUrl = await OAuthService.initiateOAuth(platform.id, user.uid);
      window.location.href = authUrl;
    } catch (err) {
      setError('Failed to initiate connection. Please try again.');
      console.error('Error connecting account:', err);
      setLoading(null);
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          Connect Social Media Account
        </h3>
        <div className="mt-5">
          <div className="space-y-4">
            {platforms.map((platform) => (
              <div
                key={platform.id}
                className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400"
              >
                <div className="flex-shrink-0">
                  <img
                    className="h-10 w-10"
                    src={platform.icon}
                    alt={platform.name}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="focus:outline-none">
                    <p className="text-sm font-medium text-gray-900">
                      {platform.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {platform.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleConnect(platform)}
                  disabled={loading === platform.id}
                  className={`inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium shadow-sm
                    ${loading === platform.id
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    }`}
                >
                  {loading === platform.id ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 