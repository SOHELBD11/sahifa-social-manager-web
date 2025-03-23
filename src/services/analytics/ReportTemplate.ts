import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';

export interface ReportTemplate {
  id: string;
  userId: string;
  name: string;
  description: string;
  format: 'csv' | 'json';
  includeMetrics: boolean;
  includeAlerts: boolean;
  includePlatformData: boolean;
  metrics?: {
    deliveryRate: boolean;
    openRate: boolean;
    clickRate: boolean;
    bounceRate: boolean;
    engagementScore: boolean;
  };
  customFields?: {
    name: string;
    type: 'number' | 'string' | 'boolean';
    description: string;
  }[];
  emailSubject: string;
  emailBody: string;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'reportTemplates';

export class ReportTemplateService {
  static async createTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReportTemplate> {
    const now = new Date();
    const newTemplate: ReportTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    };

    await this.saveTemplate(newTemplate);
    return newTemplate;
  }

  static async updateTemplate(template: ReportTemplate): Promise<void> {
    const updatedTemplate = {
      ...template,
      updatedAt: new Date()
    };

    await this.saveTemplate(updatedTemplate);
  }

  static async deleteTemplate(templateId: string): Promise<void> {
    const templateRef = doc(db, COLLECTION_NAME, templateId);
    await deleteDoc(templateRef);
  }

  static async getTemplates(userId: string): Promise<ReportTemplate[]> {
    const templatesQuery = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(templatesQuery);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt)
      } as ReportTemplate;
    });
  }

  private static async saveTemplate(template: ReportTemplate): Promise<void> {
    const templateRef = doc(db, COLLECTION_NAME, template.id);
    
    // Convert Date objects to timestamps for Firestore
    const templateData = {
      ...template,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString()
    };

    await setDoc(templateRef, templateData);
  }

  static getDefaultMetrics(): ReportTemplate['metrics'] {
    return {
      deliveryRate: true,
      openRate: true,
      clickRate: true,
      bounceRate: true,
      engagementScore: true
    };
  }

  static getDefaultEmailTemplate(templateName: string): Pick<ReportTemplate, 'emailSubject' | 'emailBody'> {
    return {
      emailSubject: `${templateName} Report`,
      emailBody: `Dear recipient,

Please find attached your ${templateName.toLowerCase()} report. This report includes:
{{#if includeMetrics}}
- Email performance metrics
{{/if}}
{{#if includeAlerts}}
- System alerts and notifications
{{/if}}
{{#if includePlatformData}}
- Platform-specific analytics
{{/if}}

For any questions or concerns, please contact our support team.

Best regards,
Your Analytics Team`
    };
  }
} 