"use client";

type SessionStatusTone = "emerald" | "amber" | "sky" | "rose" | "slate";

const IST_TIME_ZONE = "Asia/Kolkata";

export function formatIstDateTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...options,
  });
}

export function formatIstDate(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: IST_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    ...options,
  });
}

export function formatIstTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...options,
  });
}

export function formatSessionStatus(status: string): string {
  const labels: Record<string, string> = {
    pending_mentor_approval: "Awaiting Mentor Confirmation",
    pending_manager_approval: "Awaiting Admin Approval",
    pending_payment: "Awaiting Payment",
    confirmed: "Confirmed",
    ready_to_join: "Ready to Join",
    in_progress: "Live Now",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No Show",
  };
  return labels[status] ?? status.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function sessionStatusTone(status: string): SessionStatusTone {
  if (status === "ready_to_join" || status === "in_progress" || status === "confirmed") return "emerald";
  if (status === "pending_mentor_approval" || status === "pending_manager_approval" || status === "pending_payment") return "amber";
  if (status === "completed") return "sky";
  if (status === "cancelled" || status === "no_show") return "rose";
  return "slate";
}

export function sessionStatusClasses(status: string): string {
  const tone = sessionStatusTone(status);
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "sky") return "border-sky-200 bg-sky-50 text-sky-800";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function sessionStatusIcon(status: string): string {
  if (status === "ready_to_join" || status === "in_progress") return "fa-solid fa-video";
  if (status === "confirmed") return "fa-solid fa-calendar-check";
  if (status === "pending_mentor_approval" || status === "pending_manager_approval" || status === "pending_payment") return "fa-solid fa-hourglass-half";
  if (status === "completed") return "fa-solid fa-circle-check";
  if (status === "cancelled" || status === "no_show") return "fa-solid fa-circle-xmark";
  return "fa-solid fa-calendar-days";
}
