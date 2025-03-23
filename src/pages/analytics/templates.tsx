import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { ReportTemplate, ReportTemplateService } from '@/services/analytics/ReportTemplate';
import { TemplatePreviewService } from '@/services/analytics/TemplatePreview';
import { PlusIcon, PencilIcon, TrashIcon, DocumentDuplicateIcon, EyeIcon } from '@heroicons/react/24/outline';

interface TemplateFormData extends Omit<ReportTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {}

export default function TemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    format: 'csv',
    includeMetrics: true,
    includeAlerts: true,
    includePlatformData: true,
    metrics: ReportTemplateService.getDefaultMetrics(),
    customFields: [],
    ...ReportTemplateService.getDefaultEmailTemplate('')
  });

  useEffect(() => {
    if (!user) return;

    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        const userTemplates = await ReportTemplateService.getTemplates(user.uid);
        setTemplates(userTemplates);
      } catch (err) {
        setError('Failed to load report templates');
        console.error('Error loading templates:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setError(null);
      if (editingTemplate) {
        await ReportTemplateService.updateTemplate({
          ...editingTemplate,
          ...formData
        });
      } else {
        await ReportTemplateService.createTemplate({
          ...formData,
          userId: user.uid
        });
      }

      // Refresh templates
      const updatedTemplates = await ReportTemplateService.getTemplates(user.uid);
      setTemplates(updatedTemplates);
      
      // Reset form
      setIsFormOpen(false);
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        format: 'csv',
        includeMetrics: true,
        includeAlerts: true,
        includePlatformData: true,
        metrics: ReportTemplateService.getDefaultMetrics(),
        customFields: [],
        ...ReportTemplateService.getDefaultEmailTemplate('')
      });
    } catch (err) {
      setError('Failed to save report template');
      console.error('Error saving template:', err);
    }
  };

  const handleEdit = (template: ReportTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      format: template.format,
      includeMetrics: template.includeMetrics,
      includeAlerts: template.includeAlerts,
      includePlatformData: template.includePlatformData,
      metrics: template.metrics || ReportTemplateService.getDefaultMetrics(),
      customFields: template.customFields || [],
      emailSubject: template.emailSubject,
      emailBody: template.emailBody
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      setError(null);
      await ReportTemplateService.deleteTemplate(templateId);
      setTemplates(templates.filter(t => t.id !== templateId));
    } catch (err) {
      setError('Failed to delete report template');
      console.error('Error deleting template:', err);
    }
  };

  const handleDuplicate = async (template: ReportTemplate) => {
    if (!user) return;

    try {
      setError(null);
      const { id, userId, createdAt, updatedAt, ...templateData } = template;
      await ReportTemplateService.createTemplate({
        ...templateData,
        name: `${templateData.name} (Copy)`,
        userId: user.uid
      });

      // Refresh templates
      const updatedTemplates = await ReportTemplateService.getTemplates(user.uid);
      setTemplates(updatedTemplates);
    } catch (err) {
      setError('Failed to duplicate template');
      console.error('Error duplicating template:', err);
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
          <h1 className="text-2xl font-semibold text-gray-900">Report Templates</h1>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Template
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Template List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {templates.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No report templates found. Create one to get started.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {templates.map(template => (
                <li key={template.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-medium text-gray-900">
                        {template.name}
                      </h3>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>{template.description}</p>
                        <p>Format: {template.format.toUpperCase()}</p>
                        <p>
                          Includes: {[
                            template.includeMetrics && 'Metrics',
                            template.includeAlerts && 'Alerts',
                            template.includePlatformData && 'Platform Data'
                          ].filter(Boolean).join(', ')}
                        </p>
                        {template.customFields && template.customFields.length > 0 && (
                          <p>Custom Fields: {template.customFields.length}</p>
                        )}
                        <p className="text-xs">
                          Last updated: {new Date(template.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="text-gray-400 hover:text-gray-500"
                        title="Duplicate template"
                      >
                        <DocumentDuplicateIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="text-gray-400 hover:text-gray-500"
                        title="Edit template"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="text-gray-400 hover:text-red-500"
                        title="Delete template"
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

        {/* Template Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-6 p-6">
                <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    {editingTemplate ? 'Edit Template' : 'New Template'}
                  </h2>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const preview = document.createElement('a');
                        const data = formData.format === 'csv'
                          ? TemplatePreviewService.generateCSVPreview(formData as ReportTemplate)
                          : TemplatePreviewService.generateJSONPreview(formData as ReportTemplate);
                        const blob = new Blob([data], { type: formData.format === 'csv' ? 'text/csv' : 'application/json' });
                        preview.href = URL.createObjectURL(blob);
                        preview.download = `preview.${formData.format}`;
                        document.body.appendChild(preview);
                        preview.click();
                        document.body.removeChild(preview);
                        URL.revokeObjectURL(preview.href);
                      }}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      Preview Data
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormOpen(false);
                        setEditingTemplate(null);
                      }}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <span className="sr-only">Close</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {/* Left column - Template configuration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Template Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({ 
                            ...formData, 
                            name: e.target.value,
                            ...(!editingTemplate ? ReportTemplateService.getDefaultEmailTemplate(e.target.value) : {})
                          });
                        }}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
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

                      {formData.includeMetrics && (
                        <div className="ml-7 space-y-3">
                          {Object.entries(formData.metrics || {}).map(([key, value]) => (
                            <div key={key} className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={value}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  metrics: {
                                    ...(formData.metrics || {}),
                                    [key]: e.target.checked
                                  }
                                })}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label className="text-sm text-gray-700">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}

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
                  </div>

                  <div className="space-y-4">
                    {/* Right column - Email template */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Email Subject
                      </label>
                      <input
                        type="text"
                        value={formData.emailSubject}
                        onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-medium text-gray-700">
                          Email Body
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const preview = TemplatePreviewService.generateEmailPreview(formData as ReportTemplate);
                              const previewWindow = window.open('', '_blank');
                              if (previewWindow) {
                                previewWindow.document.write(`
                                  <html>
                                    <head>
                                      <title>Email Preview</title>
                                      <style>
                                        body { font-family: Arial, sans-serif; padding: 20px; }
                                        pre { white-space: pre-wrap; }
                                      </style>
                                    </head>
                                    <body>
                                      <h2>${formData.emailSubject}</h2>
                                      <pre>${preview}</pre>
                                    </body>
                                  </html>
                                `);
                              }
                            } catch (err) {
                              console.error('Error generating preview:', err);
                              alert('Failed to generate preview. Please check your template syntax.');
                            }
                          }}
                          className="inline-flex items-center px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Preview
                        </button>
                      </div>
                      <textarea
                        value={formData.emailBody}
                        onChange={(e) => setFormData({ ...formData, emailBody: e.target.value })}
                        rows={12}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
                      />
                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                        <p>Available template variables:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Use <code>{'{{#if condition}}...{{/if}}'}</code> for conditional content</li>
                          <li>Use <code>{'{{formatNumber value}}'}</code> to format numbers with commas</li>
                          <li>Use <code>{'{{formatPercent value}}'}</code> to format percentages</li>
                          {formData.includeMetrics && (
                            <li>Metrics: <code>metrics.deliveryRate</code>, <code>metrics.openRate</code>, etc.</li>
                          )}
                          {formData.includeAlerts && (
                            <li>Alerts: <code>alerts.critical</code>, <code>alerts.warning</code>, <code>alerts.info</code></li>
                          )}
                          {formData.includePlatformData && (
                            <li>Platform data: <code>platformData.gmail.deliveryRate</code>, etc.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingTemplate(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {editingTemplate ? 'Update Template' : 'Create Template'}
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