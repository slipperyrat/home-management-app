import { useState, useEffect, useCallback } from 'react';
import { CalendarTemplate, getCalendarTemplates } from '@/lib/entitlements';
import { logger } from '@/lib/logging/logger';

interface UseCalendarTemplatesProps {
  householdId: string;
  templateType?: 'school_term' | 'sports_training' | 'custom';
}

export function useCalendarTemplates({ householdId, templateType }: UseCalendarTemplatesProps) {
  const [templates, setTemplates] = useState<CalendarTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCalendarTemplates(householdId);
      setTemplates(data);
    } catch (err) {
      logger.error('Error loading calendar templates', err as Error, { householdId });
      setError('Failed to load calendar templates');
    } finally {
      setIsLoading(false);
    }
  }, [householdId]);

  const createTemplate = async (templateData: Omit<CalendarTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const response = await fetch('/api/calendar-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...templateData,
          household_id: householdId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create template');
      }

      const newTemplate = await response.json();
      setTemplates(prev => [newTemplate, ...prev]);
      return newTemplate;
    } catch (err) {
      logger.error('Error creating calendar template', err as Error, { householdId });
      setError(err instanceof Error ? err.message : 'Failed to create template');
      throw err;
    }
  };

  const updateTemplate = async (templateId: string, updates: Partial<CalendarTemplate>) => {
    try {
      const response = await fetch(`/api/calendar-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update template');
      }

      const updatedTemplate = await response.json();
      setTemplates(prev =>
        prev.map(template =>
          template.id === templateId ? updatedTemplate : template
        )
      );
      return updatedTemplate;
    } catch (err) {
      logger.error('Error updating calendar template', err as Error, { householdId, templateId });
      setError(err instanceof Error ? err.message : 'Failed to update template');
      throw err;
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/calendar-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }

      setTemplates(prev => prev.filter(template => template.id !== templateId));
    } catch (err) {
      logger.error('Error deleting calendar template', err as Error, { householdId, templateId });
      setError(err instanceof Error ? err.message : 'Failed to delete template');
      throw err;
    }
  };

  const createEventsFromTemplate = async (template: CalendarTemplate) => {
    try {
      return template.events;
    } catch (err) {
      logger.error('Error creating events from template', err as Error, { householdId, templateId: template.id });
      setError(err instanceof Error ? err.message : 'Failed to create events from template');
      throw err;
    }
  };

  useEffect(() => {
    if (householdId) {
      loadTemplates();
    }
  }, [householdId, templateType, loadTemplates]);

  const filteredTemplates = templateType
    ? templates.filter(template => template.template_type === templateType)
    : templates;

  return {
    templates: filteredTemplates,
    isLoading,
    error,
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createEventsFromTemplate,
  };
}
