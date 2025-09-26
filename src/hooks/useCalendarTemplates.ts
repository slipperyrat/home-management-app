import { useState, useEffect } from 'react';
import { CalendarTemplate, getCalendarTemplates } from '@/lib/entitlements';

interface UseCalendarTemplatesProps {
  householdId: string;
  templateType?: 'school_term' | 'sports_training' | 'custom';
}

export function useCalendarTemplates({ householdId, templateType }: UseCalendarTemplatesProps) {
  const [templates, setTemplates] = useState<CalendarTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCalendarTemplates(householdId);
      setTemplates(data);
    } catch (err) {
      console.error('Error loading calendar templates:', err);
      setError('Failed to load calendar templates');
    } finally {
      setIsLoading(false);
    }
  };

  const createTemplate = async (templateData: Omit<CalendarTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const response = await fetch('/api/calendar-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          household_id: householdId,
          ...templateData,
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
      console.error('Error creating template:', err);
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
      console.error('Error updating template:', err);
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
      console.error('Error deleting template:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete template');
      throw err;
    }
  };

  const createEventsFromTemplate = async (template: CalendarTemplate) => {
    try {
      // This would integrate with your calendar event creation API
      // For now, we'll just return the template events
      return template.events;
    } catch (err) {
      console.error('Error creating events from template:', err);
      setError(err instanceof Error ? err.message : 'Failed to create events from template');
      throw err;
    }
  };

  useEffect(() => {
    if (householdId) {
      loadTemplates();
    }
  }, [householdId, templateType]);

  // Filter templates by type if specified
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
