import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { EmailMonitor } from '@/services/monitoring/EmailMonitor';
import { ExportService } from '@/services/analytics/ExportService';
import { Switch } from '@headlessui/react';
import { ExclamationCircleIcon, CheckCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface AlertConfigFormData {
  enabled: boolean;
  thresholds: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    failureCount: number;
    responseTime: number;
  };
  notificationChannels: {
    email: boolean;
    dashboard: boolean;
    slack?: string;
  };
  cooldown: number;
}

interface RateLimitStatus {
  remaining: number;
  resetTime: Date;
  isLimited: boolean;
}

interface RateLimitInfo {
  alerts: RateLimitStatus;
  emails: RateLimitStatus;
  notifications: RateLimitStatus;
}

export default function MonitoringDashboard() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AlertConfigFormData | null>(null);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitInfo | null>(null);
  const [exportOptions, setExportOptions] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    endDate: new Date(),
    format: 'csv' as 'csv' | 'json',
    includeMetrics: true,
    includeAlerts: true,
    includePlatformData: true
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load config, active alerts, and rate limits
        const [configData, alertsData, rateLimitData] = await Promise.all([
          EmailMonitor.getAlertConfig(user.uid),
          EmailMonitor.getActiveAlerts(user.uid),
          EmailMonitor.getRateLimitStatus(user.uid)
        ]);

        setConfig(configData);
        setAlerts(alertsData);
        setRateLimits(rateLimitData);
      } catch (err) {
        setError('Failed to load monitoring data');
        console.error('Error loading monitoring data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Start monitoring
    const unsubscribe = EmailMonitor.startMonitoring(user.uid);
    return () => unsubscribe();
  }, [user]);

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !config) return;

    try {
      setSaving(true);
      setError(null);
      await EmailMonitor.updateAlertConfig(user.uid, config);
    } catch (err) {
      setError('Failed to update monitoring configuration');
      console.error('Error updating config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAlertResolve = async (alertId: string) => {
    try {
      await EmailMonitor.resolveAlert(alertId);
      setAlerts(alerts.filter(alert => alert.id !== alertId));
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  const handleExport = async () => {
    if (!user) return;

    try {
      setExporting(true);
      setError(null);

      const result = await ExportService.exportData(user.uid, exportOptions);

      // Create and trigger download
      const blob = result.mimeType === 'application/zip'
        ? Buffer.from(result.data, 'base64')
        : new Blob([result.data], { type: result.mimeType });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export analytics data');
      console.error('Error exporting data:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Email Monitoring</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Rate Limits Status */}
        {rateLimits && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Rate Limits Status</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Alerts Rate Limit */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-900">Alerts</h3>
                  <div className={`text-sm ${rateLimits.alerts.isLimited ? 'text-red-600' : 'text-green-600'}`}>
                    {rateLimits.alerts.isLimited ? 'Rate Limited' : 'Available'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {rateLimits.alerts.remaining} remaining
                  </div>
                  <div className="text-xs text-gray-400">
                    Resets at {rateLimits.alerts.resetTime.toLocaleTimeString()}
                  </div>
                </div>

                {/* Email Rate Limit */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-900">Emails</h3>
                  <div className={`text-sm ${rateLimits.emails.isLimited ? 'text-red-600' : 'text-green-600'}`}>
                    {rateLimits.emails.isLimited ? 'Rate Limited' : 'Available'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {rateLimits.emails.remaining} remaining
                  </div>
                  <div className="text-xs text-gray-400">
                    Resets at {rateLimits.emails.resetTime.toLocaleTimeString()}
                  </div>
                </div>

                {/* Notifications Rate Limit */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                  <div className={`text-sm ${rateLimits.notifications.isLimited ? 'text-red-600' : 'text-green-600'}`}>
                    {rateLimits.notifications.isLimited ? 'Rate Limited' : 'Available'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {rateLimits.notifications.remaining} remaining
                  </div>
                  <div className="text-xs text-gray-400">
                    Resets at {rateLimits.notifications.resetTime.toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                <p>Rate limits help prevent abuse and ensure service stability:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Alerts: 10 per minute</li>
                  <li>Emails: 100 per hour</li>
                  <li>Notifications: 50 per 5 minutes</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Active Alerts */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Active Alerts</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {alerts.length === 0 ? (
              <div className="px-6 py-4 text-sm text-gray-500">
                No active alerts
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <ExclamationCircleIcon className="h-6 w-6 text-red-500 mt-1" />
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {alert.metric}
                          {alert.platform && ` - ${alert.platform}`}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">{alert.details}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          Threshold: {alert.threshold} | Current Value: {alert.value}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAlertResolve(alert.id)}
                      className="ml-4 px-3 py-1 text-sm font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Configuration Form */}
        {config && (
          <form onSubmit={handleConfigSubmit} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Monitoring Configuration</h2>
            </div>
            <div className="px-6 py-4 space-y-6">
              {/* Enable/Disable Monitoring */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Enable Monitoring</h3>
                  <p className="text-sm text-gray-500">
                    Receive alerts when metrics fall below thresholds
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onChange={(enabled) => setConfig({ ...config, enabled })}
                  className={`${
                    config.enabled ? 'bg-blue-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      config.enabled ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
              </div>

              {/* Thresholds */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Alert Thresholds</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Minimum Delivery Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={config.thresholds.deliveryRate}
                      onChange={(e) => setConfig({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          deliveryRate: Number(e.target.value)
                        }
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Minimum Open Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={config.thresholds.openRate}
                      onChange={(e) => setConfig({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          openRate: Number(e.target.value)
                        }
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Minimum Click Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={config.thresholds.clickRate}
                      onChange={(e) => setConfig({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          clickRate: Number(e.target.value)
                        }
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Max Consecutive Failures
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.thresholds.failureCount}
                      onChange={(e) => setConfig({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          failureCount: Number(e.target.value)
                        }
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Notification Channels */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Notification Channels</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.notificationChannels.email}
                      onChange={(e) => setConfig({
                        ...config,
                        notificationChannels: {
                          ...config.notificationChannels,
                          email: e.target.checked
                        }
                      })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Email Notifications
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={config.notificationChannels.dashboard}
                      onChange={(e) => setConfig({
                        ...config,
                        notificationChannels: {
                          ...config.notificationChannels,
                          dashboard: e.target.checked
                        }
                      })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Dashboard Notifications
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Slack Webhook URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={config.notificationChannels.slack || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        notificationChannels: {
                          ...config.notificationChannels,
                          slack: e.target.value
                        }
                      })}
                      placeholder="https://hooks.slack.com/services/..."
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Alert Cooldown */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Alert Cooldown Period (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.cooldown}
                  onChange={(e) => setConfig({
                    ...config,
                    cooldown: Number(e.target.value)
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Minimum time between repeated alerts of the same type
                </p>
              </div>
            </div>

            {/* Form Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    saving ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Export Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Export Analytics Data</h2>
          </div>
          <div className="px-6 py-4 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <input
                  type="date"
                  value={exportOptions.startDate.toISOString().split('T')[0]}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    startDate: new Date(e.target.value)
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  End Date
                </label>
                <input
                  type="date"
                  value={exportOptions.endDate.toISOString().split('T')[0]}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    endDate: new Date(e.target.value)
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={exportOptions.includeMetrics}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    includeMetrics: e.target.checked
                  })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-700">
                  Include Metrics Data
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={exportOptions.includeAlerts}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    includeAlerts: e.target.checked
                  })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-700">
                  Include Alerts Data
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={exportOptions.includePlatformData}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    includePlatformData: e.target.checked
                  })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-700">
                  Include Platform-specific Data
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Export Format
              </label>
              <div className="mt-1 space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="csv"
                    checked={exportOptions.format === 'csv'}
                    onChange={(e) => setExportOptions({
                      ...exportOptions,
                      format: e.target.value as 'csv' | 'json'
                    })}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">CSV</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="json"
                    checked={exportOptions.format === 'json'}
                    onChange={(e) => setExportOptions({
                      ...exportOptions,
                      format: e.target.value as 'csv' | 'json'
                    })}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">JSON</span>
                </label>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-end">
              <button
                onClick={handleExport}
                disabled={exporting || (!exportOptions.includeMetrics && !exportOptions.includeAlerts)}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  (exporting || (!exportOptions.includeMetrics && !exportOptions.includeAlerts))
                    ? 'opacity-75 cursor-not-allowed'
                    : ''
                }`}
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                {exporting ? 'Exporting...' : 'Export Data'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 