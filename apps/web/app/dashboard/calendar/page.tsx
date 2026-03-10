"use client";

import { SessionCalendar } from "@/components/session-calendar";

export default function CalendarPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Session Calendar</h1>
      <p className="text-sm text-black/70">Create, manage, approve, and join mentorship calls from a unified calendar view.</p>
      <SessionCalendar />
    </section>
  );
}
