"use client";

import Link from "next/link";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import {
  Bars3Icon,
  BellIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function extractSessionIdFromLinkPath(linkPath?: string | null): string | null {
  if (!linkPath) return null;
  const match = linkPath.match(/\/dashboard\/sessions\/([0-9a-f-]+)/i);
  return match?.[1] ?? null;
}

// Public nav links (shown when not logged in)
const PUBLIC_NAV = [
  { name: "Home", href: "/" },
  { name: "Exams", href: "/#exams" },
  { name: "Mentors", href: "/#mentors" },
  { name: "How it works", href: "/#how-it-works" },
];

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const updateSession = useAuthStore((s) => s.updateSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [scrolled, setScrolled] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      message: string;
      is_read: boolean;
      link_path?: string | null;
      event_type?: string | null;
    }>
  >([]);
  const [notificationFilter, setNotificationFilter] = useState<"unread" | "all">("unread");

  // Dashboard has its own sidebar/header — suppress the public TopNav there
  if (pathname.startsWith("/dashboard")) return null;

  const email = session?.email ?? "";
  const displayName = session?.displayName ?? email;
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : "M";
  const roleLabel = session?.role
    ? session.role.slice(0, 1).toUpperCase() + session.role.slice(1)
    : "";
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const visibleNotifications = useMemo(
    () =>
      notificationFilter === "unread"
        ? notifications.filter((item) => !item.is_read)
        : notifications,
    [notificationFilter, notifications],
  );

  // Build nav links based on auth state
  const navigation = session
    ? [
        { name: "Dashboard", href: "/dashboard" },
        ...(session.role === "student"
          ? [{ name: "Mentors", href: "/dashboard/student/mentors" }]
          : []),
        ...(session.role === "student"
          ? [{ name: "Chats", href: "/dashboard/student/chats" }]
          : []),
        ...(session.role === "mentor"
          ? [{ name: "Students", href: "/dashboard/mentor/students" }]
          : []),
        ...(session.role === "mentor"
          ? [{ name: "Chats", href: "/dashboard/mentor/chats" }]
          : []),
        { name: "Calendar", href: "/dashboard/calendar" },
      ]
    : PUBLIC_NAV;

  const moreNavigation = session
    ? [
        { name: "Recordings", href: "/dashboard/recordings" },
        ...(session.role === "student"
          ? [{ name: "Resources", href: "/dashboard/resources" }]
          : []),
        ...(session.role === "admin" || session.role === "manager"
          ? [{ name: "Operations", href: "/dashboard/admin" }]
          : []),
      ]
    : [];

  // Scroll detection for glassmorphism effect
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sync display name
  useEffect(() => {
    if (!session?.accessToken) return;
    let active = true;
    void authedFetch("/users/me/account")
      .then((resp) => parseJsonSafe(resp).then((data) => ({ ok: resp.ok, data })))
      .then(({ ok, data }) => {
        if (!active || !ok) return;
        const nextName = String(data?.display_name ?? data?.email ?? session.email);
        if (nextName !== session.displayName) updateSession({ displayName: nextName });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session?.accessToken, session?.displayName, session?.email, updateSession]);

  // Fetch notifications
  useEffect(() => {
    if (!session?.accessToken) { setNotifications([]); return; }
    let active = true;
    void authedFetch("/notifications/mine")
      .then((resp) => parseJsonSafe(resp).then((data) => ({ ok: resp.ok, data })))
      .then(({ ok, data }) => {
        if (!active || !ok) return;
        setNotifications(Array.isArray(data) ? data.slice(0, 5) : []);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session?.accessToken]);

  async function openNotification(item: {
    id: string;
    link_path?: string | null;
    is_read: boolean;
  }) {
    if (!item.is_read) {
      const resp = await authedFetch(`/notifications/${item.id}/read`, { method: "PUT" });
      if (resp.ok) {
        setNotifications((cur) =>
          cur.map((e) => (e.id === item.id ? { ...e, is_read: true } : e)),
        );
      }
    }
    if (item.link_path) router.push(item.link_path);
  }

  async function markAllNotificationsRead() {
    const resp = await authedFetch("/notifications/read-all", { method: "PUT" });
    if (!resp.ok) return;
    setNotifications((cur) => cur.map((e) => ({ ...e, is_read: true })));
  }

  async function dismissInstantCall(
    event: MouseEvent,
    item: {
      id: string;
      link_path?: string | null;
      is_read: boolean;
      event_type?: string | null;
      title: string;
    },
  ) {
    event.stopPropagation();
    const sessionId = extractSessionIdFromLinkPath(item.link_path);
    if (sessionId) {
      await authedFetch(`/sessions/${sessionId}/end-call`, { method: "POST" });
    }
    const resp = await authedFetch(`/notifications/${item.id}/read`, { method: "PUT" });
    if (resp.ok) {
      setNotifications((cur) =>
        cur.map((e) => (e.id === item.id ? { ...e, is_read: true } : e)),
      );
    }
  }

  function notificationActionLabel(item: {
    event_type?: string | null;
    title: string;
    link_path?: string | null;
  }) {
    if (!item.link_path) return null;
    if (item.event_type === "instant_call" || /incoming instant call/i.test(item.title))
      return "Join";
    if (item.event_type === "recording_ready") return "Watch";
    if (item.event_type === "chat_message" || item.event_type === "chat_accepted")
      return "Open";
    return "View";
  }

  return (
    <Disclosure
      as="nav"
      className={classNames(
        "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-white/8 bg-[rgba(5,7,15,0.85)] backdrop-blur-2xl shadow-[0_4px_32px_rgba(0,0,0,0.4)]"
          : "bg-transparent",
      )}
    >
      {/* Full-width inner container — no max-width cap on the nav bar itself */}
      <div className="w-full px-4 sm:px-6 lg:px-10">
        <div className="relative flex h-16 items-center justify-between">

          {/* ── Mobile hamburger ── */}
          <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
            <DisclosureButton className="group relative inline-flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-white/8 hover:text-white focus:outline-2 focus:-outline-offset-1 focus:outline-violet-500">
              <span className="absolute -inset-0.5" />
              <span className="sr-only">Open main menu</span>
              <Bars3Icon aria-hidden="true" className="block size-6 group-data-open:hidden" />
              <XMarkIcon aria-hidden="true" className="hidden size-6 group-data-open:block" />
            </DisclosureButton>
          </div>

          {/* ── Logo + nav links ── */}
          <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
            {/* Logo */}
            <div className="flex shrink-0 items-center">
              <Link href="/" className="flex items-center gap-2.5">
                {/* Gradient icon */}
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 shadow-[0_2px_12px_rgba(124,58,237,0.5)]">
                  <span className="text-xs font-black text-white">MX</span>
                </div>
                {/* Gradient text */}
                <span
                  className="hidden text-base font-black sm:block"
                  style={{
                    background: "linear-gradient(135deg, #a78bfa 0%, #60a5fa 60%, #34d399 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  MentorX
                </span>
              </Link>
            </div>

            {/* Desktop nav links */}
            <div className="hidden sm:ml-8 sm:block">
              <div className="flex items-center space-x-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className={classNames(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      pathname === item.href
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/6 hover:text-white",
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
                {session && moreNavigation.length > 0 && (
                  <Menu as="div" className="relative">
                    <MenuButton className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/6 hover:text-white">
                      More
                    </MenuButton>
                    <MenuItems className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-2xl border border-white/10 bg-[#0d111f] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.6)] outline-none">
                      {moreNavigation.map((item) => (
                        <MenuItem key={item.href}>
                          <Link
                            href={item.href}
                            className="block rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white data-focus:bg-white/8 data-focus:outline-hidden"
                          >
                            {item.name}
                          </Link>
                        </MenuItem>
                      ))}
                    </MenuItems>
                  </Menu>
                )}
              </div>
            </div>
          </div>

          {/* ── Right side: CTA / notifications / user ── */}
          <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2 sm:static sm:inset-auto sm:ml-4 sm:pr-0">

            {/* Public CTA buttons */}
            {!session && (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/login"
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/30 hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="cta-shimmer relative rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-bold text-white shadow-[0_2px_16px_rgba(124,58,237,0.4)] transition hover:from-violet-500 hover:to-blue-500"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Notification bell (authenticated) */}
            {session && (
              <Menu as="div" className="relative">
                <MenuButton className="relative flex items-center justify-center rounded-xl p-2 text-slate-400 transition hover:bg-white/8 hover:text-white focus:outline-2 focus:outline-offset-2 focus:outline-violet-500">
                  <BellIcon aria-hidden="true" className="size-5" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
                  )}
                </MenuButton>
                <MenuItems className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-2xl border border-white/10 bg-[#0d111f] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.6)] outline-none">
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">Updates</p>
                        <p className="text-xs text-slate-500">
                          Messages, recordings, calls, session events
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markAllNotificationsRead()}
                          className="text-[11px] font-semibold text-violet-400 hover:text-violet-300"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/4 p-1 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setNotificationFilter("unread")}
                        className={classNames(
                          "rounded-full px-3 py-1 transition",
                          notificationFilter === "unread"
                            ? "bg-white/10 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-300",
                        )}
                      >
                        Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationFilter("all")}
                        className={classNames(
                          "rounded-full px-3 py-1 transition",
                          notificationFilter === "all"
                            ? "bg-white/10 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-300",
                        )}
                      >
                        All
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 space-y-2 overflow-y-auto px-1 pb-1">
                    {visibleNotifications.length > 0 ? (
                      visibleNotifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void openNotification(item)}
                          className={classNames(
                            "block w-full rounded-xl border px-3 py-3 text-left transition",
                            item.is_read
                              ? "border-white/8 bg-white/3 hover:bg-white/6"
                              : "border-violet-500/30 bg-violet-500/8 hover:bg-violet-500/12",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{item.title}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-400">{item.message}</p>
                              {notificationActionLabel(item) && (
                                <div className="mt-3">
                                  <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-slate-300">
                                      {notificationActionLabel(item)}
                                    </span>
                                    {(item.event_type === "instant_call" ||
                                      /incoming instant call/i.test(item.title)) && (
                                      <button
                                        type="button"
                                        onClick={(event) => void dismissInstantCall(event, item)}
                                        className="inline-flex rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-400"
                                      >
                                        Disconnect
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            {!item.is_read && (
                              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-400" />
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-white/3 px-3 py-5 text-center text-sm text-slate-500">
                        {notificationFilter === "unread" ? "No unread updates" : "No updates yet"}
                      </div>
                    )}
                  </div>
                </MenuItems>
              </Menu>
            )}

            {/* User avatar menu (authenticated) */}
            {session ? (
              <Menu as="div" className="relative ml-1">
                <MenuButton className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-[11px] font-black text-white shadow-[0_2px_12px_rgba(124,58,237,0.4)] transition hover:shadow-[0_2px_20px_rgba(124,58,237,0.6)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500">
                  <span className="sr-only">Open user menu</span>
                  {initials}
                </MenuButton>
                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-2 w-72 origin-top-right rounded-2xl border border-white/10 bg-[#0d111f] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.6)] outline-none transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
                >
                  {/* User info card */}
                  <div className="mb-2 rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-xs font-black text-white">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                        <p className="truncate text-xs text-slate-500">{email}</p>
                        <p className="mt-1 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-300">
                          {roleLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                  <MenuItem>
                    <Link
                      href="/dashboard/profile"
                      className="block rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white data-focus:bg-white/8 data-focus:outline-hidden"
                    >
                      Account & Identity
                    </Link>
                  </MenuItem>
                  <MenuItem>
                    <button
                      type="button"
                      className="block w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium text-rose-400 transition hover:bg-rose-500/10 data-focus:bg-rose-500/10 data-focus:outline-hidden"
                      onClick={() => {
                        clearSession();
                        router.push("/login");
                      }}
                    >
                      Sign out
                    </button>
                  </MenuItem>
                </MenuItems>
              </Menu>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Mobile panel ── */}
      <DisclosurePanel className="sm:hidden">
        <div className="border-t border-white/8 bg-[rgba(5,7,15,0.95)] px-4 pb-4 pt-3 backdrop-blur-2xl">
          <div className="space-y-1">
            {navigation.map((item) => (
              <DisclosureButton
                key={item.name}
                as={Link}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={classNames(
                  "block rounded-xl px-4 py-2.5 text-base font-medium transition",
                  pathname === item.href
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/6 hover:text-white",
                )}
              >
                {item.name}
              </DisclosureButton>
            ))}
            {moreNavigation.map((item) => (
              <DisclosureButton
                key={item.name}
                as={Link}
                href={item.href}
                className="block rounded-xl px-4 py-2.5 text-base font-medium text-slate-400 transition hover:bg-white/6 hover:text-white"
              >
                {item.name}
              </DisclosureButton>
            ))}
            {session && (
              <DisclosureButton
                as={Link}
                href="/dashboard/profile"
                className="block rounded-xl px-4 py-2.5 text-base font-medium text-slate-400 transition hover:bg-white/6 hover:text-white"
              >
                Profile
              </DisclosureButton>
            )}
          </div>

          {/* Mobile CTA buttons (public only) */}
          {!session && (
            <div className="mt-4 flex flex-col gap-2 border-t border-white/8 pt-4">
              <Link
                href="/login"
                className="block rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-slate-300 transition hover:border-white/30 hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="block rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:from-violet-500 hover:to-blue-500"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
