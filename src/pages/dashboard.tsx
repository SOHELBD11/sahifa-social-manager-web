import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';

interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  status: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSocialAccounts = async () => {
      if (!user) return;
      
      try {
        const q = query(
          collection(db, 'socialAccounts'),
          where('userId', '==', user.uid)
        );
        
        const querySnapshot = await getDocs(q);
        const accounts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as SocialAccount[];
        
        setSocialAccounts(accounts);
      } catch (error) {
        console.error('Error fetching social accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSocialAccounts();
  }, [user]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your social media accounts and view analytics
            </p>
          </div>
          <Link
            href="/connect-account"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Connect New Account
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900">Connected Accounts</h2>
            
            {loading ? (
              <div className="mt-4">Loading...</div>
            ) : socialAccounts.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {socialAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {account.platform}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {account.username}
                      </p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        account.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {account.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-gray-500">No social accounts connected yet.</p>
                <Link
                  href="/connect-account"
                  className="mt-3 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Connect Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
} 