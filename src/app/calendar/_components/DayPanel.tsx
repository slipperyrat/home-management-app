import type { DateTime } from "luxon";

import type { CalendarInstance } from "../_lib/events";

export type DayPanelProps = {
  date: DateTime;
  timezone: string;
  events: CalendarInstance[];
};

export function DayPanel({ date, timezone, events }: DayPanelProps) {
  return (
    <section className="flex h-full flex-col rounded-3xl border border-white/5 bg-[#101522]">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{date.toFormat("cccc, d LLLL")}</h2>
          <p className="text-xs text-slate-400">Timezone: {timezone}</p>
        </div>
        <a className="text-xs text-blue-400 hover:text-blue-200" href="/calendars">
          Manage calendars →
        </a>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {events.length === 0 ? <EmptyState /> : events.map((event) => <EventCard key={event.instanceId} event={event} />)}
      </div>
    </section>
  );
}

function EventCard({ event }: { event: CalendarInstance }) {
  const timeLabel = event.isAllDay
    ? "All day"
    : `${event.startsAt.toFormat("h:mm a")} – ${event.endsAt.toFormat("h:mm a")}`;

  return (
    <article className="rounded-2xl border border-white/5 bg-[#0d121f] p-4 shadow-sm shadow-black/20">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{timeLabel}</p>
          <h3 className="mt-1 text-base font-semibold text-white">{event.title}</h3>
        </div>
        {event.location ? (
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-wide text-slate-400">
            {event.location}
          </span>
        ) : null}
      </header>

      {event.description ? <p className="mt-2 text-sm text-slate-300 line-clamp-3">{event.description}</p> : null}

      {event.source ? <footer className="mt-3 text-xs text-slate-500">Imported via {event.source}</footer> : null}
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d121f]/60 p-6 text-center">
      <p className="text-sm font-medium text-slate-300">No events today</p>
      <p className="mt-2 text-xs text-slate-500">Create a new event or import from Google Calendar to get started.</p>
    </div>
  );
}

