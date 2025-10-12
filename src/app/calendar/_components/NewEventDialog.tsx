"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createEventAction } from "../_lib/actions";

const DEFAULT_TIMEZONE = "Australia/Melbourne";

type FormState = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  timezone: string;
  rrule: string;
  calendarId: string;
};

type NewEventDialogProps = {
  monthKey: string;
};

export function NewEventDialog({ monthKey }: NewEventDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [isAllDay, setIsAllDay] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    description: "",
    timezone: DEFAULT_TIMEZONE,
    rrule: "",
    calendarId: "",
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createEventAction(monthKey, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Event created");
      resetForm();
      setOpen(false);
    });
  };

  const resetForm = () => {
    setFormState({
      title: "",
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      description: "",
      timezone: DEFAULT_TIMEZONE,
      rrule: "",
      calendarId: "",
    });
    setIsAllDay(false);
    setShowAdvanced(false);
  };

  const handleAllDayToggle = (checked: boolean) => {
    setIsAllDay(checked);
    if (checked) {
      setFormState((prev) => ({ ...prev, startTime: "00:00", endTime: "23:59" }));
    } else {
      setFormState((prev) => ({ ...prev, startTime: "", endTime: "" }));
    }
  };

  const updateField = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" leftIcon={<span aria-hidden>＋</span>}>
          New Event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-[#0d121f] text-slate-100">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create event</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Field label="Title" htmlFor="title">
              <Input
                id="title"
                name="title"
                required
                value={formState.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Date" htmlFor="date">
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  value={formState.date}
                  onChange={(event) => updateField("date", event.target.value)}
                />
              </Field>
              <div className="flex items-center gap-2 pt-6">
                <Switch id="allDay" name="allDay" checked={isAllDay} onCheckedChange={(checked) => handleAllDayToggle(Boolean(checked))} />
                <Label htmlFor="allDay">All day</Label>
              </div>
            </div>

            {!isAllDay ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Start time" htmlFor="startTime">
                  <Input
                    id="startTime"
                    name="startTime"
                    type="time"
                    required
                    value={formState.startTime}
                    onChange={(event) => updateField("startTime", event.target.value)}
                  />
                </Field>
                <Field label="End time" htmlFor="endTime">
                  <Input
                    id="endTime"
                    name="endTime"
                    type="time"
                    required
                    value={formState.endTime}
                    onChange={(event) => updateField("endTime", event.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            <Field label="Location" htmlFor="location">
              <Input
                id="location"
                name="location"
                value={formState.location}
                onChange={(event) => updateField("location", event.target.value)}
              />
            </Field>

            <Field label="Description" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                rows={3}
                value={formState.description}
                onChange={(event) => updateField("description", event.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              className="text-xs text-blue-300 hover:text-blue-200"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? "Hide advanced" : "Show advanced"}
            </button>
            {showAdvanced ? (
              <div className="space-y-3 rounded-lg border border-white/10 bg-[#0b0f19] p-3">
                <Field label="Timezone" htmlFor="timezone">
                  <Input
                    id="timezone"
                    name="timezone"
                    value={formState.timezone}
                    onChange={(event) => updateField("timezone", event.target.value)}
                  />
                </Field>
                <Field label="RRULE" htmlFor="rrule">
                  <Input
                    id="rrule"
                    name="rrule"
                    value={formState.rrule}
                    onChange={(event) => updateField("rrule", event.target.value)}
                    placeholder="FREQ=WEEKLY;BYDAY=MO"
                  />
                </Field>
                <Field label="Calendar ID" htmlFor="calendarId">
                  <Input
                    id="calendarId"
                    name="calendarId"
                    value={formState.calendarId}
                    onChange={(event) => updateField("calendarId", event.target.value)}
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <Separator className="bg-white/10" />

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={pending} isLoading={pending}>
              Create event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

