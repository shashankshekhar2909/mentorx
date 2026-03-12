"use client";

import { useEffect, useState } from "react";

import { apiUrl, parseJsonSafe } from "@/lib/api";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
};

const categoryDescriptions: Record<string, string> = {
  gate: "Work through technical concepts, problem-solving approach, and exam strategy with mentors who understand engineering prep.",
  "jee-main-advanced": "Get help with concept clarity, mock-test mistakes, and the pressure of balancing speed with accuracy.",
  "neet-ug": "Use mentor guidance for biology-heavy revision, tricky physics doubts, and disciplined medical entrance preparation.",
  "upsc-cse": "Discuss answer writing, subject planning, and the long preparation cycle needed for serious civil services prep.",
  cat: "Sharpen aptitude, verbal strategy, and mock analysis with mentors who can guide both score-building and exam temperament.",
  "ssc-cgl": "Improve quant, reasoning, and revision consistency with support tailored to government exam preparation rhythms.",
  banking: "Prepare for aptitude, reasoning, and interview stages with focused guidance for banking exam progression.",
};

function categoryDescriptionFor(row: CategoryRow): string {
  return (
    categoryDescriptions[row.slug] ??
    `Get guided support, live doubt solving, and revision-friendly mentoring for ${row.name}.`
  );
}

export function PublicCategories() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch(apiUrl("/categories"))
      .then(async (response) => {
        const data = await parseJsonSafe(response);
        if (!active || !response.ok || !Array.isArray(data)) return;
        setRows(
          data.map((row) => ({
            id: String(row.id),
            name: String(row.name),
            slug: String(row.slug),
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-[2rem] border border-[#eadfcf] bg-[linear-gradient(180deg,#fffefb,#fff7ed)] p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Exam categories</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Students should immediately see the exams they can prepare for here.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            These are the live preparation tracks on the platform. They help students understand where mentor discovery starts and how their preparation journey is grouped.
          </p>
        </div>
        <div className="rounded-2xl border border-[#eadfcf] bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          {loading ? "Loading exam tracks..." : `${rows.length} active exam tracks`}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row, index) => (
          <article
            key={row.id}
            className="group rounded-[1.5rem] border border-[#eadfcf] bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(120,53,15,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Exam {index + 1}</p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">{row.name}</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {row.slug}
              </span>
            </div>
            <div className="mt-5 h-2 rounded-full bg-amber-100">
              <div className="h-2 rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300" style={{ width: `${55 + (index % 4) * 10}%` }} />
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              {categoryDescriptionFor(row)}
            </p>
          </article>
        ))}

        {!loading && rows.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-[#d8c6ad] bg-white px-5 py-6 text-sm text-slate-500">
            Exam categories will appear here once live preparation tracks are configured.
          </div>
        )}
      </div>
    </section>
  );
}
