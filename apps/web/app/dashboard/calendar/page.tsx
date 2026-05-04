"use client";

import { SessionCalendar } from "@/components/session-calendar";

export default function CalendarPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Session Calendar</h1>
        <p className="mt-1 text-sm text-slate-400">Create, manage, approve, and join mentorship calls from a unified calendar view.</p>
      </div>
      <SessionCalendar />
    </section>
  );
}
