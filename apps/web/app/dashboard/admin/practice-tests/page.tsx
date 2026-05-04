"use client";

import { useEffect, useMemo, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type TestListItem = {
  id: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  title: string;
  description: string | null;
  is_active: boolean;
  is_published: boolean;
  question_count: number;
};

type QuestionEditor = {
  temp_key: string;
  id?: string;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string;
  position: number;
  is_active: boolean;
};

type TestDetail = {
  id: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  title: string;
  description: string | null;
  is_active: boolean;
  is_published: boolean;
  question_count: number;
  questions: Array<Omit<QuestionEditor, "temp_key">>;
};

function blankQuestion(position: number): QuestionEditor {
  return {
    temp_key: `new-${position}-${Math.random().toString(36).slice(2, 9)}`,
    prompt: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_option: "A",
    explanation: "",
    position,
    is_active: true,
  };
}

function normalizeQuestions(items: QuestionEditor[]): QuestionEditor[] {
  return items.map((item, index) => ({ ...item, position: index + 1 }));
}

function updateQuestion(
  items: QuestionEditor[],
  index: number,
  patch: Partial<QuestionEditor>,
): QuestionEditor[] {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
}

export default function PracticeTestsAdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("new");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [questions, setQuestions] = useState<QuestionEditor[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeQuestionCount = useMemo(() => questions.filter((item) => item.is_active).length, [questions]);

  async function refreshTests(preferredId?: string) {
    setLoading(true);
    const [categoriesResp, testsResp] = await Promise.all([
      authedFetch("/categories"),
      authedFetch("/practice-tests?active_only=false"),
    ]);
    const [categoriesData, testsData] = await Promise.all([
      parseJsonSafe(categoriesResp),
      parseJsonSafe(testsResp),
    ]);
    const categoryRows = Array.isArray(categoriesData) ? (categoriesData as Category[]) : [];
    const testRows = Array.isArray(testsData) ? (testsData as TestListItem[]) : [];
    setCategories(categoryRows);
    setTests(testRows);
    if (selectedTestId === "new" && categoryRows[0] && !categoryId) {
      setCategoryId(categoryRows[0].id);
    }
    if (preferredId) {
      setSelectedTestId(preferredId);
    }
    setLoading(false);
  }

  function resetForm(defaultCategoryId?: string) {
    setTitle("");
    setDescription("");
    setCategoryId(defaultCategoryId ?? categories[0]?.id ?? "");
    setIsActive(true);
    setIsPublished(false);
    setQuestions(Array.from({ length: 10 }, (_, index) => blankQuestion(index + 1)));
  }

  async function loadTest(testId: string) {
    if (testId === "new") {
      resetForm();
      return;
    }
    const resp = await authedFetch(`/practice-tests/${testId}`);
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Unable to load test");
      return;
    }
    const detail = data as TestDetail;
    setTitle(detail.title);
    setDescription(detail.description ?? "");
    setCategoryId(detail.category_id);
    setIsActive(detail.is_active);
    setIsPublished(detail.is_published);
    setQuestions(
      detail.questions.map((question) => ({
        temp_key: question.id ?? `existing-${question.position}`,
        id: question.id,
        prompt: question.prompt,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        correct_option: question.correct_option,
        explanation: question.explanation ?? "",
        position: question.position,
        is_active: question.is_active,
      })),
    );
  }

  async function saveTest(nextPublished?: boolean) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !categoryId) {
      setMessage("Title and category are required");
      return;
    }
    if (questions.length === 0) {
      setMessage("Add at least one question");
      return;
    }
    if (questions.some((question) => !question.prompt.trim() || !question.option_a.trim() || !question.option_b.trim() || !question.option_c.trim() || !question.option_d.trim())) {
      setMessage("Every question needs a prompt and four options");
      return;
    }

    setSaving(true);
    const body = {
      category_id: categoryId,
      title: trimmedTitle,
      description: description.trim() || null,
      is_active: isActive,
      is_published: nextPublished ?? isPublished,
      questions: normalizeQuestions(questions).map((question) => ({
        id: question.id,
        prompt: question.prompt,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        correct_option: question.correct_option,
        explanation: question.explanation || null,
        position: question.position,
        is_active: question.is_active,
      })),
    };
    const isNew = selectedTestId === "new";
    const resp = await authedFetch(isNew ? "/practice-tests" : `/practice-tests/${selectedTestId}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Unable to save practice test");
      setSaving(false);
      return;
    }
    const saved = data as TestDetail;
    setIsPublished(saved.is_published);
    setSelectedTestId(saved.id);
    setMessage(saved.is_published ? "Practice test saved and published." : "Practice test draft saved.");
    await refreshTests(saved.id);
    await loadTest(saved.id);
    setSaving(false);
  }

  useEffect(() => {
    void refreshTests();
  }, []);

  useEffect(() => {
    if (!loading && questions.length === 0) {
      resetForm(categories[0]?.id);
    }
  }, [loading]);

  useEffect(() => {
    if (!selectedTestId) return;
    void loadTest(selectedTestId);
  }, [selectedTestId]);

  return (
    <section className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Practice Test Authoring</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Create and publish MCQ sets</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Manage category-based practice tests, edit questions in place, and publish updated sets without losing student attempt history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedTestId("new");
              resetForm();
              setMessage("");
            }}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            New practice test
          </button>
        </div>
        {message && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      </header>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Existing tests</h2>
            <p className="mt-1 text-sm text-slate-600">Select a draft or published set to edit.</p>
            <div className="mt-4 space-y-3">
              {loading && <p className="text-sm text-slate-500">Loading tests...</p>}
              {!loading &&
                tests.map((item) => {
                  const isCurrent = item.id === selectedTestId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedTestId(item.id)}
                      className="w-full rounded-2xl border px-4 py-4 text-left transition"
                      style={{
                        borderColor: isCurrent ? "rgba(15,23,42,0.25)" : "rgba(148,163,184,0.25)",
                        background: isCurrent ? "rgba(15,23,42,0.04)" : "#ffffff",
                      }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.category_name}</p>
                      <p className="mt-1 text-base font-bold text-slate-950">{item.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600">{item.question_count} active questions</span>
                        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600">{item.is_published ? "Published" : "Draft"}</span>
                        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600">{item.is_active ? "Active" : "Hidden"}</span>
                      </div>
                    </button>
                  );
                })}
              {!loading && tests.length === 0 && <p className="text-sm text-slate-500">No practice tests available yet.</p>}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current draft</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              {[
                { label: "Questions", value: questions.length },
                { label: "Active", value: activeQuestionCount },
                { label: "Status", value: isPublished ? "Published" : "Draft" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </article>
        </aside>

        <div className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Title</label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. GATE Foundation Practice Test"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Category</label>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Select category</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Description</label>
              <textarea
                className="mt-2 min-h-[96px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this practice set is meant to measure"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                Published
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void saveTest(false)}
                disabled={saving}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => void saveTest(true)}
                disabled={saving}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
              >
                Save and publish
              </button>
              <button
                type="button"
                onClick={() => setQuestions((current) => [...current, blankQuestion(current.length + 1)])}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Add question
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Questions</h2>
                <p className="mt-1 text-sm text-slate-600">Edit question text, answer options, and explanations in one place.</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {questions.map((question, index) => (
                <article key={question.temp_key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-950">Question {index + 1}</p>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <input
                          type="checkbox"
                          checked={question.is_active}
                          onChange={(e) =>
                            setQuestions((current) => updateQuestion(current, index, { is_active: e.target.checked }))
                          }
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setQuestions((current) =>
                            normalizeQuestions(current.filter((_, itemIndex) => itemIndex !== index)),
                          )
                        }
                        className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Prompt</label>
                      <textarea
                        className="mt-2 min-h-[84px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        value={question.prompt}
                        onChange={(e) =>
                          setQuestions((current) => updateQuestion(current, index, { prompt: e.target.value }))
                        }
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {(["a", "b", "c", "d"] as const).map((key) => (
                        <div key={key}>
                          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Option {key.toUpperCase()}</label>
                          <input
                          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          value={question[`option_${key}`]}
                          onChange={(e) =>
                            setQuestions((current) => updateQuestion(current, index, { [`option_${key}`]: e.target.value } as Partial<QuestionEditor>))
                          }
                        />
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Correct option</label>
                        <select
                          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          value={question.correct_option}
                          onChange={(e) =>
                            setQuestions((current) => updateQuestion(current, index, { correct_option: e.target.value }))
                          }
                        >
                          {["A", "B", "C", "D"].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Explanation</label>
                        <textarea
                          className="mt-2 min-h-[84px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        value={question.explanation}
                        onChange={(e) =>
                          setQuestions((current) => updateQuestion(current, index, { explanation: e.target.value }))
                        }
                      />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
