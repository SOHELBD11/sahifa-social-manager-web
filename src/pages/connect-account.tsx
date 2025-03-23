import Layout from '@/components/layout/Layout';
import ConnectAccount from '@/components/social/ConnectAccount';

export default function ConnectAccountPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Connect Account</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect your social media accounts to start managing them
          </p>
        </div>

        <ConnectAccount />
      </div>
    </Layout>
  );
} 