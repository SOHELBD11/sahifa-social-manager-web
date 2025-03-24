import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Layout from '@/components/layout/Layout';

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
          {/* Add your dashboard content here */}
        </div>
      </Layout>
    </ProtectedRoute>
  );
} 