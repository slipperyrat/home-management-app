'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Calendar, Clock, Users, Plus, Trash2, Edit, Star } from 'lucide-react';
import { useUserData } from '@/hooks/useUserData';
import { getCalendarTemplates, CalendarTemplate, Entitlements, canAccessFeature } from '@/lib/entitlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import CreateTemplateForm from '@/components/CreateTemplateForm';
import { logger } from '@/lib/logging/logger';

interface CalendarTemplatesProps {
  householdId: string;
  entitlements: Entitlements;
}

type CalendarTemplateResponse = CalendarTemplate;

interface TemplateEventKeyProps {
  templateId: string;
  eventId: string;
}

const EVENT_KEY_SEPARATOR = '__';

const buildEventKey = ({ templateId, eventId }: TemplateEventKeyProps): string =>
  `${templateId}${EVENT_KEY_SEPARATOR}${eventId}`;

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

const mapTemplateResponse = (template: CalendarTemplateResponse): CalendarTemplate => ({
  ...template,
  events: template.events.map((event, index) => ({
    ...event,
    id: `${template.id}-${index}`,
  })),
});

export default function CalendarTemplates({ householdId, entitlements }: CalendarTemplatesProps) {
  useUserData();
  const [templates, setTemplates] = useState<CalendarTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const canAccessTemplates = canAccessFeature(entitlements, 'calendar_templates');

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const editingTemplate = useMemo(
    () => templates.find((template) => template.id === editingTemplateId) ?? null,
    [editingTemplateId, templates],
  );

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCalendarTemplates(householdId);
      setTemplates(data.map(mapTemplateResponse));
    } catch (err) {
      logger.error('Error loading calendar templates', err as Error, { householdId });
      setError('Failed to load calendar templates');
    } finally {
      setIsLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (canAccessTemplates) {
      void loadTemplates();
    } else {
      setIsLoading(false);
    }
  }, [canAccessTemplates, loadTemplates]);

  const handleTemplateSelect = useCallback((template: CalendarTemplate) => {
    setSelectedTemplateId(template.id);
  }, []);

  const handleCreateEvents = useCallback((template: CalendarTemplate) => {
    logger.info('Creating events from template', {
      templateId: template.id,
      householdId,
      eventCount: template.events.length,
    });
    toast.success(`Creating events from template: ${template.name}`);
  }, [householdId]);

  const handleCreateTemplate = useCallback(
    async (templateData: Omit<CalendarTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      try {
        const response = await fetch('/api/calendar-templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templateData),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(errorData.error || 'Failed to create template');
        }

        const newTemplate = mapTemplateResponse((await response.json()) as CalendarTemplateResponse);
        setTemplates((previous) => [newTemplate, ...previous]);
        setShowCreateForm(false);
        toast.success('Template created successfully');
      } catch (err) {
        logger.error('Error creating calendar template', err as Error, {
          route: 'CalendarTemplates:create',
          householdId,
        });
        toast.error('Failed to create template');
      }
    },
    [householdId],
  );

  const handleEditTemplate = useCallback(
    async (templateData: Omit<CalendarTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      if (!editingTemplateId) return;

      try {
        const response = await fetch(`/api/calendar-templates/${editingTemplateId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templateData),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(errorData.error || 'Failed to update template');
        }

        const updatedTemplate = mapTemplateResponse((await response.json()) as CalendarTemplateResponse);
        setTemplates((previous) =>
          previous.map((template) => (template.id === editingTemplateId ? updatedTemplate : template)),
        );
        setEditingTemplateId(null);
        toast.success('Template updated successfully');
      } catch (err) {
        logger.error('Error updating calendar template', err as Error, {
          templateId: editingTemplateId,
          route: 'CalendarTemplates:update',
        });
        toast.error('Failed to update template');
      }
    },
    [editingTemplateId],
  );

  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      toast.info('Deleting template...');
      try {
        const response = await fetch(`/api/calendar-templates/${templateId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(errorData.error || 'Failed to delete template');
        }

        setTemplates((previous) => previous.filter((template) => template.id !== templateId));
        setSelectedTemplateId((previousSelected) => (previousSelected === templateId ? null : previousSelected));
        toast.success('Template deleted successfully');
      } catch (err) {
        logger.error('Error deleting calendar template', err as Error, {
          templateId,
          route: 'CalendarTemplates:delete',
        });
        toast.error('Failed to delete template');
      }
    },
    [],
  );

  const handleCancelCreate = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingTemplateId(null);
  }, []);

  const handleOpenCreateForm = useCallback(() => {
    setShowCreateForm(true);
  }, []);

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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Calendar Templates</h3>
            <p className="text-gray-600 mb-4">
              Create events quickly using pre-built templates like school terms and sports schedules.
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700">Upgrade to Pro</Button>
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
          onCancel={handleCancelCreate}
        />
      ) : editingTemplate ? (
        <CreateTemplateForm
          householdId={householdId}
          template={editingTemplate}
          onCreateTemplate={handleCreateTemplate}
          onEditTemplate={handleEditTemplate}
          onCancel={handleCancelEdit}
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
                <CardDescription>Pre-built calendar templates for quick event creation</CardDescription>
              </div>
              <Button onClick={handleOpenCreateForm} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Templates Yet</h3>
                <p className="text-gray-600 mb-4">Create your first calendar template to get started.</p>
                <Button onClick={handleOpenCreateForm} className="bg-blue-600 hover:bg-blue-700">
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
                      selectedTemplateId === template.id ? 'ring-2 ring-blue-500' : ''
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
                      {template.description ? (
                        <CardDescription className="text-sm">{template.description}</CardDescription>
                      ) : null}
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
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCreateEvents(template);
                          }}
                        >
                          Use Template
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingTemplateId(template.id);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {template.household_id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteTemplate(template.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedTemplate ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTemplateIcon(selectedTemplate.template_type)}
              {selectedTemplate.name}
            </CardTitle>
            <CardDescription>{selectedTemplate.description || 'Template details'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Events in this template:</h4>
                <div className="space-y-2">
                  {selectedTemplate.events.map((event) => (
                    <div
                      key={buildEventKey({ templateId: selectedTemplate.id, eventId: event.id })}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: event.color || '#3B82F6' }} />
                      <div className="flex-1">
                        <div className="font-medium">{event.title}</div>
                        <div className="text-sm text-gray-600">
                          {event.start} - {event.end}
                          {event.recurring ? (
                            <Badge variant="secondary" className="ml-2">
                              Recurring
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleCreateEvents(selectedTemplate)} className="bg-blue-600 hover:bg-blue-700">
                  Create Events from Template
                </Button>
                <Button variant="outline" onClick={() => setSelectedTemplateId(null)}>
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
