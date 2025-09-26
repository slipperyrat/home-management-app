'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Calendar, Clock } from 'lucide-react';
import { CalendarTemplate } from '@/lib/entitlements';

interface CreateTemplateFormProps {
  householdId: string;
  template?: CalendarTemplate;
  onCreateTemplate: (template: Omit<CalendarTemplate, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onEditTemplate?: (template: Omit<CalendarTemplate, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onCancel: () => void;
}

interface TemplateEvent {
  title: string;
  start: string;
  end: string;
  color: string;
  recurring?: boolean;
}

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

export default function CreateTemplateForm({ householdId, template, onCreateTemplate, onEditTemplate, onCancel }: CreateTemplateFormProps) {
  const isEditing = !!template;
  
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    template_type: template?.template_type || 'custom' as 'school_term' | 'sports_training' | 'custom',
    rrule: template?.rrule || 'FREQ=WEEKLY;BYDAY=MO',
  });

  const [events, setEvents] = useState<TemplateEvent[]>(
    template?.events || [
      {
        title: '',
        start: '09:00',
        end: '10:00',
        color: DEFAULT_COLORS[0],
        recurring: false,
      }
    ]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEventChange = (index: number, field: keyof TemplateEvent, value: string | boolean) => {
    setEvents(prev => 
      prev.map((event, i) => 
        i === index ? { ...event, [field]: value } : event
      )
    );
  };

  const addEvent = () => {
    setEvents(prev => [...prev, {
      title: '',
      start: '09:00',
      end: '10:00',
      color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length],
      recurring: false,
    }]);
  };

  const removeEvent = (index: number) => {
    if (events.length > 1) {
      setEvents(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }

    const validEvents = events.filter(event => event.title.trim());
    if (validEvents.length === 0) {
      setError('At least one event is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const templateData = {
        household_id: householdId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        template_type: formData.template_type,
        rrule: formData.rrule,
        events: validEvents,
        is_active: true,
      };

      if (isEditing && onEditTemplate) {
        await onEditTemplate(templateData);
      } else {
        await onCreateTemplate(templateData);
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        template_type: 'custom',
        rrule: 'FREQ=WEEKLY;BYDAY=MO',
      });
      setEvents([{
        title: '',
        start: '09:00',
        end: '10:00',
        color: DEFAULT_COLORS[0],
        recurring: false,
      }]);
    } catch (err) {
      console.error('Error creating template:', err);
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Weekly Team Meeting"
                required
              />
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
              placeholder="Optional description of this template"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="rrule">Recurrence Rule</Label>
            <Input
              id="rrule"
              value={formData.rrule}
              onChange={(e) => handleInputChange('rrule', e.target.value)}
              placeholder="FREQ=WEEKLY;BYDAY=MO"
            />
            <p className="text-sm text-gray-600 mt-1">
              Use RRULE format for recurring events (e.g., FREQ=WEEKLY;BYDAY=MO,TU)
            </p>
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
              {events.map((event, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Event {index + 1}</h4>
                    {events.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEvent(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`event-title-${index}`}>Event Title *</Label>
                      <Input
                        id={`event-title-${index}`}
                        value={event.title}
                        onChange={(e) => handleEventChange(index, 'title', e.target.value)}
                        placeholder="e.g., Team Meeting"
                      />
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
                      <Label htmlFor={`event-start-${index}`}>Start Time</Label>
                      <Input
                        id={`event-start-${index}`}
                        type="time"
                        value={event.start}
                        onChange={(e) => handleEventChange(index, 'start', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor={`event-end-${index}`}>End Time</Label>
                      <Input
                        id={`event-end-${index}`}
                        type="time"
                        value={event.end}
                        onChange={(e) => handleEventChange(index, 'end', e.target.value)}
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
              ))}
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting 
                ? (isEditing ? 'Updating...' : 'Creating...') 
                : (isEditing ? 'Update Template' : 'Create Template')
              }
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
