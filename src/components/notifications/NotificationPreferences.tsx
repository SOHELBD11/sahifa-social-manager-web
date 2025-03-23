import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationService } from '@/services/notifications/NotificationService';
import { AlertSeverity } from '@/services/alerts/AlertManager';
import { Platform } from '@/services/TokenManager';

interface NotificationPreferencesProps {
  onUpdate?: () => void;
}

export default function NotificationPreferences({ onUpdate }: NotificationPreferencesProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState({
    email: true,
    emailAddress: '',
    severityLevels: [] as AlertSeverity[],
    platforms: [] as Platform[],
    digestFrequency: 'immediate' as 'immediate' | 'hourly' | 'daily',
  });

  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;

      try {
        const prefs = await NotificationService.getNotificationPreferences(user.uid);
        if (prefs) {
          setPreferences(prefs);
        }
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await NotificationService.updateNotificationPreferences(user.uid, preferences);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating notification preferences:', error);
    }
  };

  const severityOptions: AlertSeverity[] = ['info', 'warning', 'error', 'critical'];
  const platformOptions: Platform[] = ['facebook', 'instagram', 'twitter', 'linkedin'];

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="h-24 bg-gray-200 rounded mb-4"></div>
        <div className="h-8 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
        <p className="mt-1 text-sm text-gray-500">
          Customize how and when you receive alert notifications.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.email}
              onChange={(e) => setPreferences({
                ...preferences,
                email: e.target.checked,
              })}
              className="h-4 w-4 text-indigo-600 rounded border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-900">Enable email notifications</span>
          </label>
        </div>

        {preferences.email && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              value={preferences.emailAddress}
              onChange={(e) => setPreferences({
                ...preferences,
                emailAddress: e.target.value,
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Alert Severity Levels
          </label>
          <div className="mt-2 space-y-2">
            {severityOptions.map((severity) => (
              <label key={severity} className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.severityLevels.includes(severity)}
                  onChange={(e) => {
                    const newLevels = e.target.checked
                      ? [...preferences.severityLevels, severity]
                      : preferences.severityLevels.filter(s => s !== severity);
                    setPreferences({
                      ...preferences,
                      severityLevels: newLevels,
                    });
                  }}
                  className="h-4 w-4 text-indigo-600 rounded border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-900 capitalize">{severity}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Platforms
          </label>
          <div className="mt-2 space-y-2">
            {platformOptions.map((platform) => (
              <label key={platform} className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.platforms.includes(platform)}
                  onChange={(e) => {
                    const newPlatforms = e.target.checked
                      ? [...preferences.platforms, platform]
                      : preferences.platforms.filter(p => p !== platform);
                    setPreferences({
                      ...preferences,
                      platforms: newPlatforms,
                    });
                  }}
                  className="h-4 w-4 text-indigo-600 rounded border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-900 capitalize">{platform}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Notification Frequency
          </label>
          <select
            value={preferences.digestFrequency}
            onChange={(e) => setPreferences({
              ...preferences,
              digestFrequency: e.target.value as 'immediate' | 'hourly' | 'daily',
            })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="immediate">Immediate</option>
            <option value="hourly">Hourly Digest</option>
            <option value="daily">Daily Digest</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Save Preferences
        </button>
      </div>
    </form>
  );
} 