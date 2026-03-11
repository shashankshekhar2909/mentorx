"use client";

import Link from "next/link";
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Bars3Icon, BellIcon, UserCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const updateSession = useAuthStore((s) => s.updateSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const email = session?.email ?? "";
  const displayName = session?.displayName ?? email;
  const initials = displayName ? displayName.slice(0, 1).toUpperCase() : "M";
  const roleLabel = session?.role ? session.role.slice(0, 1).toUpperCase() + session.role.slice(1) : "";

  const navigation = session
    ? [
        { name: "Dashboard", href: "/dashboard" },
        { name: "Calendar", href: "/dashboard/calendar" },
        { name: "Recordings", href: "/dashboard/recordings" },
        { name: "Profile", href: "/dashboard/profile" },
        ...(session.role === "student" ? [{ name: "Mentors", href: "/dashboard/student/mentors" }] : []),
        ...(session.role === "student" ? [{ name: "Chats", href: "/dashboard/student/chats" }] : []),
        ...(session.role === "mentor" ? [{ name: "Students", href: "/dashboard/mentor/students" }] : []),
        ...(session.role === "mentor" ? [{ name: "Chats", href: "/dashboard/mentor/chats" }] : []),
        ...(session.role === "student" ? [{ name: "Resources", href: "/dashboard/resources" }] : []),
        ...(session.role === "admin" || session.role === "manager" ? [{ name: "Admin", href: "/dashboard/admin" }] : []),
      ]
    : [
        { name: "Home", href: "/" },
        { name: "Login", href: "/login" },
        { name: "Join", href: "/register" },
      ];

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
                      pathname === item.href ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white",
                      "rounded-md px-3 py-2 text-sm font-medium",
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
            {session && (
              <button
                type="button"
                className="relative rounded-full p-1 text-gray-400 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-500"
              >
                <span className="absolute -inset-1.5" />
                <span className="sr-only">View notifications</span>
                <BellIcon aria-hidden="true" className="size-6" />
              </button>
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
                  <MenuItem>
                    <Link href="/dashboard/profile" className="block rounded-xl px-4 py-2 text-sm font-medium text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden">
                      Profile Settings
                    </Link>
                  </MenuItem>
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
            ) : (
              <Link href="/register" className="ml-3 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-400">
                Join
              </Link>
            )}
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
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
