"use client";

import { useEffect, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type UserRow = {
  id: string;
  email: string;
  role: string;
};

export default function AdminUsersPage() {
  const role = useAuthStore((s) => s.session?.role);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [scopes, setScopes] = useState<Record<string, string>>({});
  const [categoryOptions, setCategoryOptions] = useState<Array<{ slug: string; name: string }>>([]);

  async function refresh() {
    const usersResp = await authedFetch("/admin/users");
    const u = await parseJsonSafe(usersResp);
    setUsers(Array.isArray(u) ? u : []);
    if (role === "admin") {
      const scopesResp = await authedFetch("/admin/manager-scopes");
      const s = await parseJsonSafe(scopesResp);
      const mapped: Record<string, string> = {};
      for (const row of Array.isArray(s) ? s : []) mapped[row.manager_user_id] = (row.categories as string[]).join(",");
      setScopes(mapped);

      const categoriesResp = await authedFetch("/categories");
      const categories = await parseJsonSafe(categoriesResp);
      setCategoryOptions(
        Array.isArray(categories)
          ? categories.map((row) => ({ slug: String(row.slug), name: String(row.name) }))
          : [],
      );
    }
  }

  async function saveScope(managerUserId: string) {
    if (role !== "admin") return;
    const raw = scopes[managerUserId] ?? "";
    const categories = raw.split(",").map((x) => x.trim()).filter(Boolean);
    await authedFetch("/admin/manager-scopes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manager_user_id: managerUserId, categories }),
    });
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="rounded-xl bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Users</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/60">
              <th className="pb-2">Email</th>
              <th className="pb-2">Role</th>
              <th className="pb-2">Manager Categories</th>
              <th className="pb-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="py-2">{user.email}</td>
                <td className="py-2">{user.role}</td>
                <td className="py-2">
                  {user.role === "manager" && role === "admin" ? (
                    <div className="flex gap-2">
                      <input
                        className="rounded border px-2 py-1"
                        value={scopes[user.id] ?? ""}
                        onChange={(e) => setScopes((prev) => ({ ...prev, [user.id]: e.target.value }))}
                        placeholder="upsc-cse,gate,cat"
                      />
                      <select
                        className="rounded border px-2 py-1"
                        value=""
                        onChange={(e) => {
                          const selected = e.target.value;
                          if (!selected) return;
                          const current = (scopes[user.id] ?? "")
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean);
                          if (current.includes(selected)) return;
                          setScopes((prev) => ({ ...prev, [user.id]: [...current, selected].join(",") }));
                        }}
                      >
                        <option value="">+ category</option>
                        {categoryOptions.map((item) => (
                          <option key={item.slug} value={item.slug}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <button className="rounded border px-2 py-1" onClick={() => saveScope(user.id)}>Save</button>
                    </div>
                  ) : user.role === "manager" ? (
                    <span className="text-black/60">{scopes[user.id] ?? "Scoped by admin"}</span>
                  ) : (
                    <span className="text-black/50">-</span>
                  )}
                </td>
                <td className="py-2 text-xs text-black/60">{user.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
