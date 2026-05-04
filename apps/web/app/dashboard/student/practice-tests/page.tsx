"use client";

import { useEffect, useMemo, useState } from "react";

import { authedFetch, parseJsonSafe } from "@/lib/api";
import { formatIstDateTime } from "@/lib/presentation";

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
  my_attempt_count: number;
  my_best_percentage: number | null;
  my_latest_percentage: number | null;
};

type TestQuestion = {
  id: string;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  position: number;
};

type AttemptHistory = {
  id: string;
  score: number;
  total_questions: number;
  percentage: number;
  submitted_at: string;
};

type TestDetail = {
  id: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  title: string;
  description: string | null;
  question_count: number;
  questions: TestQuestion[];
  attempts: AttemptHistory[];
  my_attempt_count: number;
  my_best_percentage: number | null;
  my_latest_percentage: number | null;
};

type AttemptAnswerResult = {
  question_id: string;
  selected_option: string | null;
  correct_option: string;
  is_correct: boolean;
  explanation: string | null;
};

type AttemptResult = {
  attempt_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  previous_percentage: number | null;
  best_percentage: number | null;
  answers: AttemptAnswerResult[];
};

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function optionValue(question: TestQuestion, key: typeof OPTION_KEYS[number]): string {
  if (key === "A") return question.option_a;
  if (key === "B") return question.option_b;
  if (key === "C") return question.option_c;
  return question.option_d;
}

export default function StudentPracticeTestsPage() {
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [detail, setDetail] = useState<TestDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const categories = useMemo(
    () => Array.from(new Map(tests.map((item) => [item.category_slug, item.category_name])).entries()),
    [tests],
  );

  const filteredTests = useMemo(() => {
    if (categoryFilter === "all") return tests;
    return tests.filter((item) => item.category_slug === categoryFilter);
  }, [tests, categoryFilter]);

  async function refreshTests(preferredTestId?: string) {
    setLoading(true);
    const resp = await authedFetch("/practice-tests");
    const data = await parseJsonSafe(resp);
    const rows = Array.isArray(data) ? (data as TestListItem[]) : [];
    setTests(rows);
    const nextSelected =
      (preferredTestId && rows.some((item) => item.id === preferredTestId) && preferredTestId) ||
      (selectedTestId && rows.some((item) => item.id === selectedTestId) && selectedTestId) ||
      rows[0]?.id ||
      "";
    setSelectedTestId(nextSelected);
    setLoading(false);
  }

  async function loadDetail(testId: string) {
    if (!testId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    const resp = await authedFetch(`/practice-tests/${testId}`);
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setDetail(null);
      setMessage(data?.detail ?? "Unable to load practice test");
      setLoadingDetail(false);
      return;
    }
    setDetail(data as TestDetail);
    setAnswers({});
    setResult(null);
    setMessage("");
    setLoadingDetail(false);
  }

  async function submitAttempt() {
    if (!detail) return;
    const unanswered = detail.questions.filter((question) => !answers[question.id]);
    if (unanswered.length > 0) {
      setMessage(`Answer all questions before submitting. ${unanswered.length} left.`);
      return;
    }

    setSubmitting(true);
    const resp = await authedFetch(`/practice-tests/${detail.id}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: detail.questions.map((question) => ({
          question_id: question.id,
          selected_option: answers[question.id],
        })),
      }),
    });
    const data = await parseJsonSafe(resp);
    if (!resp.ok) {
      setMessage(data?.detail ?? "Unable to submit attempt");
      setSubmitting(false);
      return;
    }
    setResult(data as AttemptResult);
    setMessage("Attempt submitted. Review your score and explanations below.");
    await refreshTests(detail.id);
    await loadDetail(detail.id);
    setSubmitting(false);
  }

  useEffect(() => {
    void refreshTests();
  }, []);

  useEffect(() => {
    if (!selectedTestId) return;
    void loadDetail(selectedTestId);
  }, [selectedTestId]);

  return (
    <section className="space-y-5">
      <header className="app-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Practice Tests</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">MCQ practice by exam category</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Attempt a timed-style MCQ set, get your score immediately, and compare it against earlier attempts.
            </p>
          </div>
          <div className="min-w-[220px]">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Filter category</label>
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map(([slug, name]) => (
                <option key={slug} value={slug}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {message && <p className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">{message}</p>}
      </header>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            {[
              { label: "Available tests", value: filteredTests.length, sub: "Published and active" },
              { label: "Your attempts", value: tests.reduce((sum, item) => sum + item.my_attempt_count, 0), sub: "Across all tests" },
            ].map((stat) => (
              <article key={stat.label} className="app-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                <p className="mt-3 text-4xl font-black text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-slate-500">{stat.sub}</p>
              </article>
            ))}
          </div>

          <article className="app-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Tests</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a subject and open its current question set.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {loading && <p className="text-sm text-slate-500">Loading tests...</p>}
              {!loading && filteredTests.length === 0 && <p className="text-sm text-slate-500">No published practice tests found for this category.</p>}
              {filteredTests.map((item) => {
                const isActive = item.id === selectedTestId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedTestId(item.id)}
                    className="w-full rounded-2xl border px-4 py-4 text-left transition"
                    style={{
                      borderColor: isActive ? "rgba(124,58,237,0.45)" : "rgba(255,255,255,0.08)",
                      background: isActive ? "rgba(124,58,237,0.10)" : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.category_name}</p>
                        <p className="mt-1 text-base font-bold text-white">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{item.description ?? "No description provided."}</p>
                      </div>
                      <div className="text-right text-sm text-slate-400">
                        <p>{item.question_count} questions</p>
                        <p>{item.my_attempt_count} attempts</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-white/10 px-2.5 py-1">Best: {item.my_best_percentage ?? 0}%</span>
                      <span className="rounded-full border border-white/10 px-2.5 py-1">Latest: {item.my_latest_percentage ?? 0}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </article>
        </div>

        <div className="space-y-4">
          {!selectedTestId && !loading && (
            <article className="app-card p-6">
              <h2 className="text-xl font-bold text-white">Select a practice test</h2>
              <p className="mt-2 text-sm text-slate-500">Your question set and attempt history will appear here.</p>
            </article>
          )}

          {loadingDetail && <article className="app-card p-6 text-sm text-slate-500">Loading practice test...</article>}

          {detail && !loadingDetail && (
            <>
              <article className="app-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{detail.category_name}</p>
                    <h2 className="mt-2 text-2xl font-extrabold text-white">{detail.title}</h2>
                    <p className="mt-2 text-sm text-slate-400">{detail.description ?? "Practice this set and compare your progress over time."}</p>
                  </div>
                  <div className="grid gap-2 text-right text-sm text-slate-400">
                    <p>{detail.question_count} questions</p>
                    <p>{detail.my_attempt_count} attempts</p>
                    <p>Best: {detail.my_best_percentage ?? 0}%</p>
                  </div>
                </div>
              </article>

              <article className="app-card p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">Question set</h3>
                    <p className="mt-1 text-sm text-slate-500">Pick one answer per question, then submit to score the attempt.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAnswers({});
                      setResult(null);
                      setMessage("");
                    }}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
                  >
                    Reset answers
                  </button>
                </div>

                <div className="mt-5 space-y-5">
                  {detail.questions.map((question) => {
                    const resultRow = result?.answers.find((item) => item.question_id === question.id);
                    return (
                      <article key={question.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Question {question.position}</p>
                        <p className="mt-2 text-base font-semibold text-white">{question.prompt}</p>
                        <div className="mt-4 grid gap-2">
                          {OPTION_KEYS.map((key) => {
                            const value = optionValue(question, key);
                            const checked = answers[question.id] === key;
                            const isCorrect = resultRow?.correct_option === key;
                            const isChosenWrong = resultRow?.selected_option === key && !resultRow.is_correct;
                            return (
                              <label
                                key={key}
                                className="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition"
                                style={{
                                  borderColor: isCorrect
                                    ? "rgba(16,185,129,0.35)"
                                    : isChosenWrong
                                      ? "rgba(244,63,94,0.35)"
                                      : checked
                                        ? "rgba(124,58,237,0.35)"
                                        : "rgba(255,255,255,0.08)",
                                  background: isCorrect
                                    ? "rgba(16,185,129,0.10)"
                                    : isChosenWrong
                                      ? "rgba(244,63,94,0.10)"
                                      : checked
                                        ? "rgba(124,58,237,0.10)"
                                        : "rgba(255,255,255,0.02)",
                                }}
                              >
                                <input
                                  type="radio"
                                  name={question.id}
                                  checked={checked}
                                  onChange={() => setAnswers((current) => ({ ...current, [question.id]: key }))}
                                  className="mt-1"
                                  disabled={submitting}
                                />
                                <span className="text-white">
                                  <span className="mr-2 font-bold text-slate-400">{key}.</span>
                                  {value}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {resultRow?.explanation && (
                          <div
                            className="mt-4 rounded-xl border px-3 py-3 text-sm"
                            style={{
                              borderColor: resultRow.is_correct ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.25)",
                              background: resultRow.is_correct ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)",
                            }}
                          >
                            <p className="font-semibold text-white">{resultRow.is_correct ? "Correct" : "Review this explanation"}</p>
                            <p className="mt-1 text-slate-300">{resultRow.explanation}</p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Answered {Object.keys(answers).length} of {detail.questions.length} questions
                  </p>
                  <button
                    type="button"
                    onClick={() => void submitAttempt()}
                    disabled={submitting}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Submitting..." : "Submit attempt"}
                  </button>
                </div>
              </article>

              {result && (
                <article className="app-card p-6">
                  <h3 className="text-lg font-bold text-white">Latest result</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    {[
                      { label: "Score", value: `${result.score}/${result.total_questions}` },
                      { label: "Percentage", value: `${result.percentage}%` },
                      { label: "Previous", value: `${result.previous_percentage ?? 0}%` },
                      { label: "Best", value: `${result.best_percentage ?? result.percentage}%` },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                        <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              <article className="app-card p-6">
                <h3 className="text-lg font-bold text-white">Attempt history</h3>
                <p className="mt-1 text-sm text-slate-500">Track how your score changes across repeated attempts.</p>
                <div className="mt-4 space-y-3">
                  {detail.attempts.length === 0 && <p className="text-sm text-slate-500">No attempts yet for this test.</p>}
                  {detail.attempts.map((attempt) => (
                    <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {attempt.score}/{attempt.total_questions} correct
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatIstDateTime(attempt.submitted_at)}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-slate-200">
                        {attempt.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
