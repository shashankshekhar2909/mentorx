"use client";

import Link from "next/link";
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Bars3Icon, BellIcon, UserCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";

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

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const updateSession = useAuthStore((s) => s.updateSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; title: string; message: string; is_read: boolean; link_path?: string | null; event_type?: string | null }>
  >([]);
  const [notificationFilter, setNotificationFilter] = useState<"unread" | "all">("unread");
  const email = session?.email ?? "";
  const displayName = session?.displayName ?? email;
  const initials = displayName ? displayName.slice(0, 1).toUpperCase() : "M";
  const roleLabel = session?.role ? session.role.slice(0, 1).toUpperCase() + session.role.slice(1) : "";
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const visibleNotifications = useMemo(
    () => (notificationFilter === "unread" ? notifications.filter((item) => !item.is_read) : notifications),
    [notificationFilter, notifications],
  );

  const navigation = session
    ? [
        { name: "Dashboard", href: "/dashboard" },
        ...(session.role === "student" ? [{ name: "Mentors", href: "/dashboard/student/mentors" }] : []),
        ...(session.role === "student" ? [{ name: "Chats", href: "/dashboard/student/chats" }] : []),
        ...(session.role === "mentor" ? [{ name: "Students", href: "/dashboard/mentor/students" }] : []),
        ...(session.role === "mentor" ? [{ name: "Chats", href: "/dashboard/mentor/chats" }] : []),
        { name: "Calendar", href: "/dashboard/calendar" },
      ]
    : [
        { name: "Home", href: "/" },
        { name: "Login", href: "/login" },
      ];

  const publicJoinLink = !session ? { name: "Join now", href: "/register" } : null;

  const moreNavigation = session
    ? [
        { name: "Recordings", href: "/dashboard/recordings" },
        ...(session.role === "student" ? [{ name: "Resources", href: "/dashboard/resources" }] : []),
        ...(session.role === "admin" || session.role === "manager" ? [{ name: "Operations", href: "/dashboard/admin" }] : []),
      ]
    : [];

  useEffect(() => {
    if (!session?.accessToken) return;
    let active = true;
    void authedFetch("/users/me/account")
      .then((resp) => parseJsonSafe(resp).then((data) => ({ ok: resp.ok, data })))
      .then(({ ok, data }) => {
        if (!active || !ok) return;
        const nextName = String(data?.display_name ?? data?.email ?? session.email);
        if (nextName !== session.displayName) {
          updateSession({ displayName: nextName });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session?.accessToken, session?.displayName, session?.email, updateSession]);

  useEffect(() => {
    if (!session?.accessToken) {
      setNotifications([]);
      return;
    }
    let active = true;
    void authedFetch("/notifications/mine")
      .then((resp) => parseJsonSafe(resp).then((data) => ({ ok: resp.ok, data })))
      .then(({ ok, data }) => {
        if (!active || !ok) return;
        setNotifications(Array.isArray(data) ? data.slice(0, 5) : []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session?.accessToken]);

  async function openNotification(item: { id: string; link_path?: string | null; is_read: boolean }) {
    if (!item.is_read) {
      const resp = await authedFetch(`/notifications/${item.id}/read`, { method: "PUT" });
      if (resp.ok) {
        setNotifications((current) => current.map((entry) => (entry.id === item.id ? { ...entry, is_read: true } : entry)));
      }
    }
    if (item.link_path) {
      router.push(item.link_path);
    }
  }

  async function markAllNotificationsRead() {
    const resp = await authedFetch("/notifications/read-all", { method: "PUT" });
    if (!resp.ok) return;
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
  }

  async function dismissInstantCall(
    event: MouseEvent,
    item: { id: string; link_path?: string | null; is_read: boolean; event_type?: string | null; title: string },
  ) {
    event.stopPropagation();
    const sessionId = extractSessionIdFromLinkPath(item.link_path);
    if (sessionId) {
      await authedFetch(`/sessions/${sessionId}/end-call`, { method: "POST" });
    }
    const resp = await authedFetch(`/notifications/${item.id}/read`, { method: "PUT" });
    if (resp.ok) {
      setNotifications((current) => current.map((entry) => (entry.id === item.id ? { ...entry, is_read: true } : entry)));
    }
  }

  function notificationActionLabel(item: { event_type?: string | null; title: string; link_path?: string | null }) {
    if (!item.link_path) return null;
    if (item.event_type === "instant_call" || /incoming instant call/i.test(item.title)) return "Join";
    if (item.event_type === "recording_ready") return "Watch";
    if (item.event_type === "chat_message" || item.event_type === "chat_accepted") return "Open";
    return "View";
  }

  return (
    <Disclosure as="nav" className="sticky top-0 z-50 bg-gray-800">
      <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">
          <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
            <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white focus:outline-2 focus:-outline-offset-1 focus:outline-indigo-500">
              <span className="absolute -inset-0.5" />
              <span className="sr-only">Open main menu</span>
              <Bars3Icon aria-hidden="true" className="block size-6 group-data-open:hidden" />
              <XMarkIcon aria-hidden="true" className="hidden size-6 group-data-open:block" />
            </DisclosureButton>
          </div>

          <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
            <div className="flex shrink-0 items-center">
              <Link href="/" className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500 text-sm font-extrabold text-white">
                  M
                </span>
                <span className="text-sm font-semibold text-white sm:text-base">mentorXAI</span>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:block">
              <div className="flex space-x-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className={classNames(
                      "rounded-md px-3 py-2 text-sm font-medium",
                      pathname === item.href ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
                {session && moreNavigation.length > 0 && (
                  <Menu as="div" className="relative">
                    <MenuButton className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white">
                      More
                    </MenuButton>
                    <MenuItems className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-2xl border border-slate-200 bg-white p-2 shadow-lg outline outline-black/5">
                      {moreNavigation.map((item) => (
                        <MenuItem key={item.href}>
                          <Link href={item.href} className="block rounded-xl px-4 py-2 text-sm font-medium text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden">
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

          <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
            {!session && publicJoinLink && (
              <Link
                href={publicJoinLink.href}
                className="cta-pulse cta-shimmer relative overflow-hidden rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-200"
              >
                {publicJoinLink.name}
              </Link>
            )}
            {session && (
              <Menu as="div" className="relative">
                <MenuButton className="relative rounded-full p-1 text-gray-400 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-500">
                  <span className="absolute -inset-1.5" />
                  <span className="sr-only">View notifications</span>
                  <BellIcon aria-hidden="true" className="size-6" />
                  {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500" />}
                </MenuButton>
                <MenuItems className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-lg outline outline-black/5">
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Updates</p>
                        <p className="text-xs text-slate-500">Messages, recordings, calls, and session events</p>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markAllNotificationsRead()}
                          className="text-[11px] font-semibold text-accent"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setNotificationFilter("unread")}
                        className={classNames(
                          "rounded-full px-3 py-1",
                          notificationFilter === "unread" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
                        )}
                      >
                        Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationFilter("all")}
                        className={classNames(
                          "rounded-full px-3 py-1",
                          notificationFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
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
                            "block w-full rounded-xl border px-3 py-3 text-left",
                            item.is_read ? "border-slate-200 bg-slate-50" : "border-teal-200 bg-teal-50/50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p>
                              {notificationActionLabel(item) && (
                                <div className="mt-3">
                                  <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                                      {notificationActionLabel(item)}
                                    </span>
                                    {(item.event_type === "instant_call" || /incoming instant call/i.test(item.title)) && (
                                      <button
                                        type="button"
                                        onClick={(event) => void dismissInstantCall(event, item)}
                                        className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700"
                                      >
                                        Disconnect
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            {!item.is_read && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-500" />}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
                        {notificationFilter === "unread" ? "No unread updates" : "No updates yet"}
                      </div>
                    )}
                  </div>
                </MenuItems>
              </Menu>
            )}

            {session ? (
              <Menu as="div" className="relative ml-3">
                <MenuButton className="relative flex size-8 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
                  <span className="absolute -inset-1.5" />
                  <span className="sr-only">Open user menu</span>
                  {initials}
                </MenuButton>

                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-2 w-72 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-lg outline outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
                >
                  <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                        <UserCircleIcon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                        <p className="truncate text-xs text-slate-500">{email}</p>
                        <p className="mt-1 inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {roleLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                  {session && (
                    <MenuItem>
                      <Link href="/dashboard/profile" className="block rounded-xl px-4 py-2 text-sm font-medium text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden">
                        Account & Identity
                      </Link>
                    </MenuItem>
                  )}
                  <MenuItem>
                    <button
                      type="button"
                      className="block w-full rounded-xl px-4 py-2 text-left text-sm font-medium text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden"
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

      <DisclosurePanel className="sm:hidden">
        <div className="space-y-1 px-2 pb-3 pt-2">
          {navigation.map((item) => (
            <DisclosureButton
              key={item.name}
              as={Link}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={classNames(
                pathname === item.href ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white",
                "block rounded-md px-3 py-2 text-base font-medium",
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
              aria-current={pathname === item.href ? "page" : undefined}
              className={classNames(
                pathname === item.href ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white",
                "block rounded-md px-3 py-2 text-base font-medium",
              )}
            >
              {item.name}
            </DisclosureButton>
          ))}
          {session && (
            <DisclosureButton
              as={Link}
              href="/dashboard/profile"
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-white/5 hover:text-white"
            >
              Profile
            </DisclosureButton>
          )}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
