import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { EmailAnalytics } from '@/services/notifications/EmailAnalytics';
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
import { Line, Bar, Doughnut } from 'react-chartjs-2';

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

interface TimeRange {
  label: string;
  days: number;
}

const timeRanges: TimeRange[] = [
  { label: 'Last 24 Hours', days: 1 },
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
];

export default function EmailAnalytics() {
  const { user } = useAuth();
  const [selectedRange, setSelectedRange] = useState<TimeRange>(timeRanges[0]);
  const [metrics, setMetrics] = useState<AggregatedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - selectedRange.days * 24 * 60 * 60 * 1000);
        
        const result = await EmailAnalytics.getMetrics(user.uid, startDate, endDate);
        setMetrics(result);
      } catch (err) {
        setError('Failed to load email analytics');
        console.error('Error fetching metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [user, selectedRange]);

  const deliveryRateData = {
    labels: ['Delivered', 'Failed'],
    datasets: [{
      data: metrics ? [metrics.delivered, metrics.failed] : [],
      backgroundColor: ['#10B981', '#EF4444'],
      borderColor: ['#059669', '#DC2626'],
      borderWidth: 1,
    }],
  };

  const engagementData = {
    labels: ['Delivered', 'Opened', 'Clicked'],
    datasets: [{
      label: 'Email Engagement',
      data: metrics ? [metrics.delivered, metrics.opened, metrics.clicked] : [],
      backgroundColor: '#3B82F6',
    }],
  };

  const platformData = {
    labels: metrics ? Object.keys(metrics.byPlatform) : [],
    datasets: [{
      label: 'Sent',
      data: metrics ? Object.values(metrics.byPlatform).map(p => p.sent) : [],
      backgroundColor: '#10B981',
    }, {
      label: 'Opened',
      data: metrics ? Object.values(metrics.byPlatform).map(p => p.opened) : [],
      backgroundColor: '#3B82F6',
    }, {
      label: 'Clicked',
      data: metrics ? Object.values(metrics.byPlatform).map(p => p.clicked) : [],
      backgroundColor: '#6366F1',
    }],
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Email Analytics</h1>
          <div className="flex gap-2">
            {timeRanges.map((range) => (
              <button
                key={range.label}
                onClick={() => setSelectedRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  selectedRange.label === range.label
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        ) : metrics ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Sent</h3>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{metrics.totalSent}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Delivery Rate</h3>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {metrics.totalSent ? ((metrics.delivered / metrics.totalSent) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Open Rate</h3>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {metrics.delivered ? ((metrics.opened / metrics.delivered) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Click Rate</h3>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {metrics.opened ? ((metrics.clicked / metrics.opened) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Success Rate</h3>
                <div className="h-64">
                  <Doughnut 
                    data={deliveryRateData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Email Engagement</h3>
                <div className="h-64">
                  <Bar 
                    data={engagementData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Platform Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Performance</h3>
              <div className="h-96">
                <Bar 
                  data={platformData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: {
                        stacked: false,
                      },
                      y: {
                        stacked: false,
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* Type Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Types</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Count
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        % of Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(metrics.byType).map(([type, count]) => (
                      <tr key={type}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {metrics.totalSent ? ((count / metrics.totalSent) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
} 