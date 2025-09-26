'use client';

import { useState, useEffect } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { getCalendarTemplates, CalendarTemplate } from '@/lib/entitlements';
import { canAccessFeature } from '@/lib/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, Plus, Trash2, Edit, Star } from 'lucide-react';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import CreateTemplateForm from '@/components/CreateTemplateForm';

interface CalendarTemplatesProps {
  householdId: string;
  entitlements: any;
}

export default function CalendarTemplates({ householdId, entitlements }: CalendarTemplatesProps) {
  const { userData } = useUserData();
  const [templates, setTemplates] = useState<CalendarTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CalendarTemplate | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CalendarTemplate | null>(null);

  // Check if user can access calendar templates (Pro feature)
  const canAccessTemplates = canAccessFeature(entitlements, 'calendar_templates');

  useEffect(() => {
    if (canAccessTemplates) {
      loadTemplates();
    } else {
      setIsLoading(false);
    }
  }, [canAccessTemplates, householdId]);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCalendarTemplates(householdId);
      setTemplates(data);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load calendar templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (template: CalendarTemplate) => {
    setSelectedTemplate(template);
  };

  const handleCreateEvents = async (template: CalendarTemplate) => {
    try {
      // This would integrate with your calendar event creation API
      // For now, we'll just show a success message
      alert(`Creating events from template: ${template.name}`);
      console.log('Creating events from template:', template);
    } catch (err) {
      console.error('Error creating events:', err);
      setError('Failed to create events from template');
    }
  };

  const handleCreateTemplate = async (templateData: Omit<CalendarTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const response = await fetch('/api/calendar-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create template');
      }

      const newTemplate = await response.json();
      setTemplates(prev => [newTemplate, ...prev]);
      setShowCreateForm(false);
    } catch (err) {
      console.error('Error creating template:', err);
      setError(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  const handleEditTemplate = async (templateData: Omit<CalendarTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editingTemplate) return;

    try {
      const response = await fetch(`/api/calendar-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update template');
      }

      const updatedTemplate = await response.json();
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updatedTemplate : t));
      setEditingTemplate(null);
    } catch (err) {
      console.error('Error updating template:', err);
      setError(err instanceof Error ? err.message : 'Failed to update template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/calendar-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }

      setTemplates(prev => prev.filter(t => t.id !== templateId));
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    } catch (err) {
      console.error('Error deleting template:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  const getTemplateIcon = (templateType?: string) => {
    switch (templateType) {
      case 'school_term':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'sports_training':
        return <Users className="h-5 w-5 text-green-500" />;
      default:
        return <Star className="h-5 w-5 text-purple-500" />;
    }
  };

  const getTemplateColor = (templateType?: string) => {
    switch (templateType) {
      case 'school_term':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sports_training':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  if (!canAccessTemplates) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Templates
          </CardTitle>
          <CardDescription>
            Pre-built calendar templates for quick event creation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Calendar Templates
            </h3>
            <p className="text-gray-600 mb-4">
              Create events quickly using pre-built templates like school terms and sports schedules.
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Upgrade to Pro
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorDisplay error={error} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {showCreateForm ? (
        <CreateTemplateForm
          householdId={householdId}
          onCreateTemplate={handleCreateTemplate}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : editingTemplate ? (
        <CreateTemplateForm
          householdId={householdId}
          template={editingTemplate}
          onCreateTemplate={handleCreateTemplate}
          onEditTemplate={handleEditTemplate}
          onCancel={() => setEditingTemplate(null)}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Calendar Templates
                </CardTitle>
                <CardDescription>
                  Pre-built calendar templates for quick event creation
                </CardDescription>
              </div>
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Templates Yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first calendar template to get started.
              </p>
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card 
                  key={template.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTemplate?.id === template.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getTemplateIcon(template.template_type)}
                        <CardTitle className="text-lg">{template.name || 'Untitled Template'}</CardTitle>
                      </div>
                      <Badge className={getTemplateColor(template.template_type)}>
                        {template.template_type?.replace('_', ' ') || 'Custom'}
                      </Badge>
                    </div>
                    {template.description && (
                      <CardDescription className="text-sm">
                        {template.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span>{template.events.length} events</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span className="truncate">{template.rrule}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateEvents(template);
                        }}
                      >
                        Use Template
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTemplate(template);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {template.household_id && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        </Card>
      )}

      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTemplateIcon(selectedTemplate.template_type)}
              {selectedTemplate.name}
            </CardTitle>
            <CardDescription>
              {selectedTemplate.description || 'Template details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Events in this template:</h4>
                <div className="space-y-2">
                  {selectedTemplate.events.map((event, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: event.color || '#3B82F6' }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{event.title}</div>
                        <div className="text-sm text-gray-600">
                          {event.start} - {event.end}
                          {event.recurring && (
                            <Badge variant="secondary" className="ml-2">Recurring</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleCreateEvents(selectedTemplate)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Create Events from Template
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setSelectedTemplate(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
