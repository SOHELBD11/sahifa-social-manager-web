import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertManager, AlertSeverity } from '@/services/alerts/AlertManager';
import { Platform } from '@/services/TokenManager';
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface AlertsListProps {
  platform?: Platform;
  limit?: number;
}

const severityIcons = {
  info: InformationCircleIcon,
  warning: ExclamationTriangleIcon,
  error: ExclamationCircleIcon,
  critical: XCircleIcon,
};

const severityColors = {
  info: 'text-blue-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  critical: 'text-red-700',
};

export default function AlertsList({ platform, limit = 5 }: AlertsListProps) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    severity?: AlertSeverity;
    acknowledged: boolean;
  }>({
    acknowledged: false,
  });

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!user) return;

      try {
        const fetchedAlerts = await AlertManager.getAlerts(user.uid, {
          platform,
          limit,
          ...filter,
        });
        setAlerts(fetchedAlerts);
      } catch (error) {
        console.error('Error fetching alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [user, platform, limit, filter]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await AlertManager.acknowledgeAlert(alertId);
      setAlerts(alerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      ));
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-gray-200 rounded-md mb-4"></div>
        <div className="h-20 bg-gray-200 rounded-md mb-4"></div>
        <div className="h-20 bg-gray-200 rounded-md"></div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-lg shadow">
        <InformationCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts</h3>
        <p className="mt-1 text-sm text-gray-500">
          Everything is running smoothly!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Alerts</h2>
        <div className="flex space-x-2">
          <select
            value={filter.severity || ''}
            onChange={(e) => setFilter({
              ...filter,
              severity: e.target.value as AlertSeverity || undefined,
            })}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
          <button
            onClick={() => setFilter({
              ...filter,
              acknowledged: !filter.acknowledged,
            })}
            className={`px-3 py-1 rounded-md text-sm ${
              filter.acknowledged
                ? 'bg-gray-200 text-gray-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {filter.acknowledged ? 'Show Unacknowledged' : 'Show Acknowledged'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => {
          const Icon = severityIcons[alert.severity];
          return (
            <div
              key={alert.id}
              className={`flex items-start space-x-4 p-4 bg-white rounded-lg shadow ${
                !alert.acknowledged ? 'border-l-4 ' + severityColors[alert.severity] : ''
              }`}
            >
              <Icon className={`h-6 w-6 ${severityColors[alert.severity]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {alert.message}
                </p>
                <p className="text-sm text-gray-500">
                  {alert.platform} - {alert.metric}: {alert.value} (threshold: {alert.threshold})
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
              {!alert.acknowledged && (
                <button
                  onClick={() => handleAcknowledge(alert.id)}
                  className="flex items-center px-2 py-1 text-sm text-green-700 hover:bg-green-100 rounded"
                >
                  <CheckCircleIcon className="h-5 w-5 mr-1" />
                  Acknowledge
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 