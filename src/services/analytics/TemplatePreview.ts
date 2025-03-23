import { ReportTemplate } from './ReportTemplate';
import Handlebars from 'handlebars';

interface PreviewData {
  metrics?: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    engagementScore: number;
    totalSent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  };
  alerts?: {
    critical: number;
    warning: number;
    info: number;
    recentAlerts: {
      type: 'critical' | 'warning' | 'info';
      message: string;
      timestamp: string;
    }[];
  };
  platformData?: {
    [platform: string]: {
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      deliveryRate: number;
      openRate: number;
      clickRate: number;
    };
  };
}

export class TemplatePreviewService {
  private static getSampleMetrics(): PreviewData['metrics'] {
    return {
      deliveryRate: 98.5,
      openRate: 45.2,
      clickRate: 15.8,
      bounceRate: 1.5,
      engagementScore: 7.4,
      totalSent: 1000,
      delivered: 985,
      opened: 445,
      clicked: 156,
      bounced: 15
    };
  }

  private static getSampleAlerts(): PreviewData['alerts'] {
    return {
      critical: 1,
      warning: 2,
      info: 5,
      recentAlerts: [
        {
          type: 'critical',
          message: 'Delivery rate dropped below threshold (95%)',
          timestamp: new Date().toISOString()
        },
        {
          type: 'warning',
          message: 'Open rate below average for last 3 campaigns',
          timestamp: new Date().toISOString()
        },
        {
          type: 'info',
          message: 'New email campaign started',
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  private static getSamplePlatformData(): PreviewData['platformData'] {
    return {
      gmail: {
        sent: 500,
        delivered: 490,
        opened: 225,
        clicked: 78,
        deliveryRate: 98.0,
        openRate: 45.9,
        clickRate: 15.9
      },
      outlook: {
        sent: 300,
        delivered: 295,
        opened: 130,
        clicked: 45,
        deliveryRate: 98.3,
        openRate: 44.1,
        clickRate: 15.3
      },
      yahoo: {
        sent: 200,
        delivered: 195,
        opened: 90,
        clicked: 33,
        deliveryRate: 97.5,
        openRate: 46.2,
        clickRate: 16.9
      }
    };
  }

  static generatePreviewData(template: ReportTemplate): PreviewData {
    const previewData: PreviewData = {};

    if (template.includeMetrics) {
      previewData.metrics = this.getSampleMetrics();
    }

    if (template.includeAlerts) {
      previewData.alerts = this.getSampleAlerts();
    }

    if (template.includePlatformData) {
      previewData.platformData = this.getSamplePlatformData();
    }

    return previewData;
  }

  static generateCSVPreview(template: ReportTemplate): string {
    const data = this.generatePreviewData(template);
    const rows: string[] = [];
    
    // Headers
    const headers: string[] = [];
    if (template.includeMetrics) {
      headers.push(
        'Delivery Rate (%)',
        'Open Rate (%)',
        'Click Rate (%)',
        'Bounce Rate (%)',
        'Engagement Score'
      );
    }
    if (template.includeAlerts) {
      headers.push(
        'Critical Alerts',
        'Warning Alerts',
        'Info Alerts'
      );
    }
    if (template.includePlatformData) {
      headers.push(
        'Platform',
        'Sent',
        'Delivered',
        'Opened',
        'Clicked',
        'Delivery Rate (%)',
        'Open Rate (%)',
        'Click Rate (%)'
      );
    }
    rows.push(headers.join(','));

    // Metrics row
    if (template.includeMetrics && data.metrics) {
      rows.push([
        data.metrics.deliveryRate,
        data.metrics.openRate,
        data.metrics.clickRate,
        data.metrics.bounceRate,
        data.metrics.engagementScore
      ].join(','));
    }

    // Alerts row
    if (template.includeAlerts && data.alerts) {
      rows.push([
        data.alerts.critical,
        data.alerts.warning,
        data.alerts.info
      ].join(','));
    }

    // Platform data rows
    if (template.includePlatformData && data.platformData) {
      Object.entries(data.platformData).forEach(([platform, stats]) => {
        rows.push([
          platform,
          stats.sent,
          stats.delivered,
          stats.opened,
          stats.clicked,
          stats.deliveryRate,
          stats.openRate,
          stats.clickRate
        ].join(','));
      });
    }

    return rows.join('\n');
  }

  static generateJSONPreview(template: ReportTemplate): string {
    const data = this.generatePreviewData(template);
    return JSON.stringify(data, null, 2);
  }

  static generateEmailPreview(template: ReportTemplate): string {
    // Register custom helpers for the template
    Handlebars.registerHelper('formatNumber', function(value: number) {
      return value.toLocaleString();
    });

    Handlebars.registerHelper('formatPercent', function(value: number) {
      return value.toFixed(1) + '%';
    });

    // Compile the template
    const compiledTemplate = Handlebars.compile(template.emailBody);

    // Generate preview data
    const data = this.generatePreviewData(template);

    // Render the template with preview data
    return compiledTemplate({
      ...data,
      includeMetrics: template.includeMetrics,
      includeAlerts: template.includeAlerts,
      includePlatformData: template.includePlatformData
    });
  }
} 