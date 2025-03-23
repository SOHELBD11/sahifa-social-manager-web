import { EmailAnalytics } from '@/services/notifications/EmailAnalytics';
import { EmailMonitor } from '@/services/monitoring/EmailMonitor';

interface ExportOptions {
  startDate: Date;
  endDate: Date;
  format: 'csv' | 'json';
  includeMetrics: boolean;
  includeAlerts: boolean;
  includePlatformData: boolean;
}

interface ExportableMetrics {
  period: string;
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  averageDeliveryTime: number;
  platformMetrics?: {
    [platform: string]: {
      sent: number;
      opened: number;
      clicked: number;
      openRate: number;
      clickRate: number;
    };
  };
}

interface ExportableAlert {
  id: string;
  type: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
  status: string;
  platform?: string;
  details: string;
  resolvedAt?: string;
}

export class ExportService {
  private static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private static async getMetricsData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ExportableMetrics[]> {
    const metrics = await EmailAnalytics.getMetrics(userId, startDate, endDate);
    
    // Calculate daily metrics
    const dailyMetrics: ExportableMetrics[] = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayMetrics = await EmailAnalytics.getMetrics(userId, currentDate, nextDate);
      
      dailyMetrics.push({
        period: this.formatDate(currentDate),
        totalSent: dayMetrics.totalSent,
        delivered: dayMetrics.delivered,
        opened: dayMetrics.opened,
        clicked: dayMetrics.clicked,
        failed: dayMetrics.failed,
        deliveryRate: (dayMetrics.delivered / dayMetrics.totalSent) * 100,
        openRate: (dayMetrics.opened / dayMetrics.delivered) * 100,
        clickRate: (dayMetrics.clicked / dayMetrics.opened) * 100,
        averageDeliveryTime: dayMetrics.averageDeliveryTime,
        platformMetrics: Object.entries(dayMetrics.byPlatform).reduce((acc, [platform, stats]) => ({
          ...acc,
          [platform]: {
            sent: stats.sent,
            opened: stats.opened,
            clicked: stats.clicked,
            openRate: (stats.opened / stats.sent) * 100,
            clickRate: (stats.clicked / stats.opened) * 100
          }
        }), {})
      });

      currentDate = nextDate;
    }

    return dailyMetrics;
  }

  private static async getAlertsData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ExportableAlert[]> {
    const alerts = await EmailMonitor.getAlerts(userId, startDate, endDate);
    
    return alerts.map(alert => ({
      id: alert.id,
      type: alert.type,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      timestamp: alert.timestamp.toISOString(),
      status: alert.status,
      platform: alert.platform,
      details: alert.details,
      resolvedAt: alert.resolvedAt?.toISOString()
    }));
  }

  private static convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Create CSV rows
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle nested objects
          if (typeof value === 'object' && value !== null) {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          // Handle strings with commas
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  static async exportData(userId: string, options: ExportOptions): Promise<{
    data: string;
    filename: string;
    mimeType: string;
  }> {
    try {
      const exportData: {
        metrics?: ExportableMetrics[];
        alerts?: ExportableAlert[];
      } = {};

      // Gather requested data
      if (options.includeMetrics) {
        exportData.metrics = await this.getMetricsData(
          userId,
          options.startDate,
          options.endDate
        );
      }

      if (options.includeAlerts) {
        exportData.alerts = await this.getAlertsData(
          userId,
          options.startDate,
          options.endDate
        );
      }

      // Remove platform data if not requested
      if (!options.includePlatformData && exportData.metrics) {
        exportData.metrics.forEach(metric => {
          delete metric.platformMetrics;
        });
      }

      const dateRange = `${this.formatDate(options.startDate)}_${this.formatDate(options.endDate)}`;
      let data: string;
      let filename: string;
      let mimeType: string;

      if (options.format === 'csv') {
        // For CSV, we need to create separate files for metrics and alerts
        if (options.includeMetrics && options.includeAlerts) {
          // Create a ZIP file with both CSV files
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();

          if (exportData.metrics) {
            zip.file('metrics.csv', this.convertToCSV(exportData.metrics));
          }
          if (exportData.alerts) {
            zip.file('alerts.csv', this.convertToCSV(exportData.alerts));
          }

          data = await zip.generateAsync({ type: 'base64' });
          filename = `email_analytics_${dateRange}.zip`;
          mimeType = 'application/zip';
        } else {
          // Single CSV file
          const csvData = exportData.metrics || exportData.alerts || [];
          data = this.convertToCSV(csvData);
          filename = `email_analytics_${dateRange}.csv`;
          mimeType = 'text/csv';
        }
      } else {
        // JSON format
        data = JSON.stringify(exportData, null, 2);
        filename = `email_analytics_${dateRange}.json`;
        mimeType = 'application/json';
      }

      return {
        data,
        filename,
        mimeType
      };
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      throw new Error('Failed to export analytics data');
    }
  }
} 