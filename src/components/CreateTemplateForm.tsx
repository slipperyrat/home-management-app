'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { CalendarTemplate } from '@/lib/entitlements';
import { useFormState } from '@/hooks/useFormValidation';
import { createCalendarTemplateSchema } from '@/lib/validation/schemas';
import { toast } from 'sonner';

interface CreateTemplateFormProps {
  householdId: string;
  template?: CalendarTemplate;
  onCreateTemplate: (template: CalendarTemplatePayload) => Promise<void>;
  onEditTemplate?: (template: CalendarTemplatePayload) => Promise<void>;
  onCancel: () => void;
}

interface TemplateEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  recurring?: boolean;
}

type CalendarTemplatePayload = {
  household_id: string;
  name: string;
  description?: string;
  template_type: CalendarTemplate['template_type'];
  rrule: string;
  events: Array<Omit<TemplateEvent, 'id'>>;
  is_active: boolean;
};

const DEFAULT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
];

const generateEventId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function CreateTemplateForm({ householdId, template, onCreateTemplate, onEditTemplate, onCancel }: CreateTemplateFormProps) {
  const isEditing = !!template;

  const {
    values: formData,
    setValue,
    reset,
    validate,
    errors,
    getFieldError,
    hasFieldError,
  } = useFormState({
    name: template?.name || '',
    description: template?.description || '',
    template_type: (template?.template_type || 'custom') as 'school_term' | 'sports_training' | 'custom',
    rrule: template?.rrule || 'FREQ=WEEKLY;BYDAY=MO',
  }, createCalendarTemplateSchema.pick({
    name: true,
    description: true,
    template_type: true,
    rrule: true,
  }));

  const initialEvents = useMemo<TemplateEvent[]>(
    () =>
      template?.events?.map((event) => ({
        id: generateEventId(),
        title: event.title,
        start: event.start,
        end: event.end,
        color: event.color || DEFAULT_COLORS[0],
        recurring: event.recurring,
      })) ?? [
        {
          id: generateEventId(),
          title: '',
          start: new Date().toISOString().slice(0, 16),
          end: new Date().toISOString().slice(0, 16),
          color: DEFAULT_COLORS[0],
          recurring: false,
        },
      ],
    [template?.events]
  );

  const [events, setEvents] = useState<TemplateEvent[]>(initialEvents);
  const [errorsState, setErrorsState] = useState<FormFieldError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const handleInputChange = useCallback(
    (field: keyof typeof formData, value: string) => {
      setValue(field, value);
    },
    [setValue]
  );

  const handleEventChange = useCallback(
    (index: number, field: keyof TemplateEvent, value: string | boolean) => {
      setEvents((prev) =>
        prev.map((event, i) =>
          i === index
            ? {
                ...event,
                [field]: value,
              }
            : event
        )
      );
    },
    []
  );

  const addEvent = useCallback(() => {
    setEvents((prev) => [
      ...prev,
      {
        id: generateEventId(),
        title: '',
        start: new Date().toISOString().slice(0, 16),
        end: new Date().toISOString().slice(0, 16),
        color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length],
        recurring: false,
      },
    ]);
  }, []);

  const removeEvent = useCallback((index: number) => {
    setEvents((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const validateEvents = useCallback(() => {
    const validationErrors: { field: string; message: string }[] = [];

    events.forEach((event) => {
      if (!event.title.trim()) {
        validationErrors.push({ field: event.id, message: 'Event title is required' });
      }
      if (!event.start || !event.end) {
        validationErrors.push({ field: event.id, message: 'Start and end time are required' });
      }
      if (event.start && event.end && new Date(event.start) >= new Date(event.end)) {
        validationErrors.push({ field: event.id, message: 'End time must be after start time' });
      }
    });

    return validationErrors;
  }, [events]);

  const handleSubmit = useCallback(
    async (submitEvent?: React.FormEvent<HTMLFormElement>) => {
      submitEvent?.preventDefault();
      setIsSubmitting(true);
      setErrorsState([]);

      const isValid = validate();
      const eventErrors = validateEvents();

      if (!isValid || eventErrors.length > 0) {
        setErrorsState(eventErrors);
        toast.error('Please fix the highlighted fields');
        setIsSubmitting(false);
        return;
      }

      const templateEvents = events.map(({ id: _id, ...rest }) => rest);

      const templateData: CalendarTemplatePayload = {
        household_id: householdId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        template_type: formData.template_type,
        rrule: formData.rrule,
        events: templateEvents,
        is_active: true,
      };

      try {
        if (isEditing && onEditTemplate) {
          await onEditTemplate(templateData);
        } else {
          await onCreateTemplate(templateData);
        }

        reset();
        setEvents([
          {
            id: generateEventId(),
            title: '',
            start: new Date().toISOString().slice(0, 16),
            end: new Date().toISOString().slice(0, 16),
            color: DEFAULT_COLORS[0],
            recurring: false,
          },
        ]);
        toast.success(isEditing ? 'Template updated successfully' : 'Template created successfully');
      } catch (submissionError) {
        console.error('Error saving template:', submissionError);
        toast.error('Failed to save template');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      events,
      formData.description,
      formData.name,
      formData.rrule,
      formData.template_type,
      householdId,
      isEditing,
      onCreateTemplate,
      onEditTemplate,
      reset,
      validate,
      validateEvents,
    ]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {isEditing ? 'Edit Calendar Template' : 'Create Calendar Template'}
        </CardTitle>
        <CardDescription>
          {isEditing ? 'Update your calendar template' : 'Create a reusable template for calendar events'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{errors[0].message}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Weekly Team Meeting"
                aria-invalid={hasFieldError('name') ? 'true' : 'false'}
              />
              {hasFieldError('name') && (
                <p className="text-sm text-red-600 mt-1" role="alert">{getFieldError('name')}</p>
              )}
            </div>
            <div>
              <Label htmlFor="template_type">Template Type</Label>
              <Select
                value={formData.template_type}
                onValueChange={(value) => handleInputChange('template_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="school_term">School Term</SelectItem>
                  <SelectItem value="sports_training">Sports Training</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe the template's purpose"
              aria-invalid={hasFieldError('description') ? 'true' : 'false'}
            />
            {hasFieldError('description') && (
              <p className="text-sm text-red-600 mt-1">{getFieldError('description')}</p>
            )}
          </div>

          <div>
            <Label htmlFor="rrule">Recurrence Rule</Label>
            <Input
              id="rrule"
              value={formData.rrule}
              onChange={(e) => handleInputChange('rrule', e.target.value)}
              placeholder="FREQ=WEEKLY;BYDAY=MO"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Events</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEvent}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Event
              </Button>
            </div>

              <div className="space-y-4">
              {events.map((event, index) => {
                const eventError = errorsState.find((eventErr) => eventErr.field === event.id);
                return (
                  <div key={event.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Event {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEvent(index)}
                        disabled={events.length === 1}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>

                    {eventError && (
                      <p className="text-sm text-red-600" role="alert">{eventError.message}</p>
                    )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`event-title-${index}`}>Event Title *</Label>
                      <Input
                        id={`event-title-${index}`}
                        value={event.title}
                        onChange={(e) => handleEventChange(index, 'title', e.target.value)}
                        placeholder="e.g., Team Meeting"
                        aria-invalid={eventError ? 'true' : 'false'}
                      />
                      {eventError && (
                        <p className="text-sm text-red-600 mt-1" role="alert">{eventError.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor={`event-color-${index}`}>Color</Label>
                      <div className="flex gap-2">
                        {DEFAULT_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`w-8 h-8 rounded-full border-2 ${
                              event.color === color ? 'border-gray-900' : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => handleEventChange(index, 'color', color)}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Start Time *</Label>
                      <Input
                        type="datetime-local"
                        value={event.start}
                        onChange={(e) => handleEventChange(index, 'start', e.target.value)}
                        aria-invalid={eventError ? 'true' : 'false'}
                      />
                    </div>

                    <div>
                      <Label>End Time *</Label>
                      <Input
                        type="datetime-local"
                        value={event.end}
                        onChange={(e) => handleEventChange(index, 'end', e.target.value)}
                        aria-invalid={eventError ? 'true' : 'false'}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`event-recurring-${index}`}
                      checked={event.recurring || false}
                      onChange={(e) => handleEventChange(index, 'recurring', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor={`event-recurring-${index}`} className="text-sm">
                      This event repeats
                    </Label>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditing ? 'Update Template' : 'Create Calendar Template'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
