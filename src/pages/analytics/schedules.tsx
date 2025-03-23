import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { ReportScheduler, ReportSchedule } from '@/services/analytics/ReportScheduler';
import { PlusIcon, PencilIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';

interface ScheduleFormData extends Omit<ReportSchedule, 'id' | 'userId' | 'lastRun' | 'nextRun'> {
  recipientEmails: string;
}

export default function SchedulesPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ReportSchedule | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>({
    name: '',
    frequency: 'daily',
    dayOfWeek: 1,
    dayOfMonth: 1,
    time: '09:00',
    format: 'csv',
    recipientEmails: '',
    recipients: [],
    includeMetrics: true,
    includeAlerts: true,
    includePlatformData: true,
    enabled: true
  });

  useEffect(() => {
    if (!user) return;

    const loadSchedules = async () => {
      try {
        setLoading(true);
        setError(null);
        const userSchedules = await ReportScheduler.getSchedules(user.uid);
        setSchedules(userSchedules);
      } catch (err) {
        setError('Failed to load report schedules');
        console.error('Error loading schedules:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSchedules();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setError(null);
      const recipients = formData.recipientEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email);

      const scheduleData = {
        ...formData,
        recipients,
        userId: user.uid
      };

      if (editingSchedule) {
        await ReportScheduler.updateSchedule({
          ...scheduleData,
          id: editingSchedule.id,
          lastRun: editingSchedule.lastRun,
          nextRun: editingSchedule.nextRun
        });
      } else {
        await ReportScheduler.createSchedule(scheduleData);
      }

      // Refresh schedules
      const updatedSchedules = await ReportScheduler.getSchedules(user.uid);
      setSchedules(updatedSchedules);
      
      // Reset form
      setIsFormOpen(false);
      setEditingSchedule(null);
      setFormData({
        name: '',
        frequency: 'daily',
        dayOfWeek: 1,
        dayOfMonth: 1,
        time: '09:00',
        format: 'csv',
        recipientEmails: '',
        recipients: [],
        includeMetrics: true,
        includeAlerts: true,
        includePlatformData: true,
        enabled: true
      });
    } catch (err) {
      setError('Failed to save report schedule');
      console.error('Error saving schedule:', err);
    }
  };

  const handleEdit = (schedule: ReportSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek || 1,
      dayOfMonth: schedule.dayOfMonth || 1,
      time: schedule.time,
      format: schedule.format,
      recipientEmails: schedule.recipients.join(', '),
      recipients: schedule.recipients,
      includeMetrics: schedule.includeMetrics,
      includeAlerts: schedule.includeAlerts,
      includePlatformData: schedule.includePlatformData,
      enabled: schedule.enabled
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      setError(null);
      await ReportScheduler.deleteSchedule(scheduleId);
      setSchedules(schedules.filter(s => s.id !== scheduleId));
    } catch (err) {
      setError('Failed to delete report schedule');
      console.error('Error deleting schedule:', err);
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
          <h1 className="text-2xl font-semibold text-gray-900">Report Schedules</h1>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Schedule
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Schedule List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {schedules.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No report schedules found. Create one to get started.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {schedules.map(schedule => (
                <li key={schedule.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-medium text-gray-900">
                        {schedule.name}
                      </h3>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p className="flex items-center">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} at {schedule.time}
                          {schedule.frequency === 'weekly' && ` on ${new Date(0, 0, schedule.dayOfWeek + 1).toLocaleString('en-US', { weekday: 'long' })}`}
                          {schedule.frequency === 'monthly' && ` on day ${schedule.dayOfMonth}`}
                        </p>
                        <p>Recipients: {schedule.recipients.join(', ')}</p>
                        <p>Format: {schedule.format.toUpperCase()}</p>
                        <p>
                          Includes: {[
                            schedule.includeMetrics && 'Metrics',
                            schedule.includeAlerts && 'Alerts',
                            schedule.includePlatformData && 'Platform Data'
                          ].filter(Boolean).join(', ')}
                        </p>
                        {schedule.lastRun && (
                          <p>Last run: {new Date(schedule.lastRun).toLocaleString()}</p>
                        )}
                        {schedule.nextRun && (
                          <p>Next run: {new Date(schedule.nextRun).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => handleEdit(schedule)}
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Schedule Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-6 p-6">
                <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    {editingSchedule ? 'Edit Schedule' : 'New Schedule'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingSchedule(null);
                    }}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Schedule Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Frequency
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {formData.frequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Day of Week
                      </label>
                      <select
                        value={formData.dayOfWeek}
                        onChange={(e) => setFormData({ ...formData, dayOfWeek: Number(e.target.value) })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        {[0, 1, 2, 3, 4, 5, 6].map(day => (
                          <option key={day} value={day}>
                            {new Date(0, 0, day + 1).toLocaleString('en-US', { weekday: 'long' })}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.frequency === 'monthly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Day of Month
                      </label>
                      <select
                        value={formData.dayOfMonth}
                        onChange={(e) => setFormData({ ...formData, dayOfMonth: Number(e.target.value) })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Time (24-hour)
                    </label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Recipients (comma-separated emails)
                    </label>
                    <textarea
                      value={formData.recipientEmails}
                      onChange={(e) => setFormData({ ...formData, recipientEmails: e.target.value })}
                      required
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
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
                          checked={formData.format === 'csv'}
                          onChange={(e) => setFormData({ ...formData, format: e.target.value as 'csv' | 'json' })}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">CSV</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="json"
                          checked={formData.format === 'json'}
                          onChange={(e) => setFormData({ ...formData, format: e.target.value as 'csv' | 'json' })}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">JSON</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.includeMetrics}
                        onChange={(e) => setFormData({ ...formData, includeMetrics: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label className="text-sm font-medium text-gray-700">
                        Include Metrics Data
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.includeAlerts}
                        onChange={(e) => setFormData({ ...formData, includeAlerts: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label className="text-sm font-medium text-gray-700">
                        Include Alerts Data
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.includePlatformData}
                        onChange={(e) => setFormData({ ...formData, includePlatformData: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label className="text-sm font-medium text-gray-700">
                        Include Platform-specific Data
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Enable Schedule
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingSchedule(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
} 