import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout/Layout';
import AlertsList from '@/components/alerts/AlertsList';
import NotificationPreferences from '@/components/notifications/NotificationPreferences';
import { PostAnalytics } from '@/services/analytics/PostAnalytics';
import { Platform } from '@/services/TokenManager';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface PlatformData {
  avgPublishDuration: number;
  avgMediaUploadDuration: number;
  successRate: number;
  errorAnalysis: { [key: string]: number };
}

const platforms: Platform[] = ['facebook', 'instagram', 'twitter', 'linkedin'];

export default function Analytics() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('facebook');
  const [platformData, setPlatformData] = useState<{ [key in Platform]?: PlatformData }>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPlatformData = async () => {
      if (!user) return;

      try {
        const data: { [key in Platform]?: PlatformData } = {};

        for (const platform of platforms) {
          const [performanceMetrics, errorAnalysis] = await Promise.all([
            PostAnalytics.getPerformanceMetrics(user.uid, platform),
            PostAnalytics.getErrorAnalysis(user.uid, platform),
          ]);

          if (performanceMetrics) {
            data[platform] = {
              ...performanceMetrics,
              errorAnalysis: errorAnalysis || {},
            };
          }
        }

        setPlatformData(data);
      } catch (err) {
        setError('Failed to load analytics data');
      }
    };

    fetchPlatformData();
  }, [user]);

  const renderPerformanceChart = () => {
    const data = {
      labels: platforms,
      datasets: [
        {
          label: 'Success Rate (%)',
          data: platforms.map(p => platformData[p]?.successRate || 0),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
        },
      ],
    };

    return (
      <div className="h-64">
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Post Success Rate by Platform',
              },
            },
          }}
        />
      </div>
    );
  };

  const renderDurationChart = () => {
    const data = {
      labels: platforms,
      datasets: [
        {
          label: 'Avg. Publish Duration (ms)',
          data: platforms.map(p => platformData[p]?.avgPublishDuration || 0),
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
        },
        {
          label: 'Avg. Media Upload Duration (ms)',
          data: platforms.map(p => platformData[p]?.avgMediaUploadDuration || 0),
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
        },
      ],
    };

    return (
      <div className="h-64">
        <Bar
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Average Operation Duration by Platform',
              },
            },
          }}
        />
      </div>
    );
  };

  const renderErrorChart = () => {
    const errorData = platformData[selectedPlatform]?.errorAnalysis || {};
    const data = {
      labels: Object.keys(errorData),
      datasets: [
        {
          data: Object.values(errorData),
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)',
          ],
        },
      ],
    };

    return (
      <div className="h-64">
        <Pie
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: `Error Distribution - ${selectedPlatform}`,
              },
            },
          }}
        />
      </div>
    );
  };

  if (loading || !isClient) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-red-500">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Analytics Dashboard</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <AlertsList limit={3} />
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <NotificationPreferences />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            {renderPerformanceChart()}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            {renderDurationChart()}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Select Platform for Error Analysis
            </label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value as Platform)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {platforms.map(platform => (
                <option key={platform} value={platform}>
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </option>
              ))}
            </select>
          </div>
          {renderErrorChart()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          {platforms.map(platform => {
            const data = platformData[platform];
            return (
              <div key={platform} className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold mb-2 capitalize">{platform}</h3>
                <div className="space-y-2">
                  <p>Success Rate: {data?.successRate.toFixed(2)}%</p>
                  <p>Avg. Publish Time: {(data?.avgPublishDuration || 0).toFixed(2)}ms</p>
                  <p>Avg. Upload Time: {(data?.avgMediaUploadDuration || 0).toFixed(2)}ms</p>
                  <p>Error Types: {Object.keys(data?.errorAnalysis || {}).length}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
} 