"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Module {
  id: string;
  title: string;
  description: string;
  topics: string[];
  estimatedHours: number;
}

interface Curriculum {
  title: string;
  description: string;
  estimatedHours: number;
  modules: Module[];
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

interface LessonContent {
  title: string;
  explanation: string;
  example: { description: string; code: string; language: string };
  practice: { prompt: string; hint: string };
  challenge: { prompt: string; hint: string };
  quiz: QuizQuestion[];
}

interface TopicProgress {
  completed: boolean;
  quizScore: number | null; // 0-100
  timeSpentMinutes: number;
}

interface EducationState {
  subject: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  goal: string;
  curriculum: Curriculum | null;
  // moduleId → topicIndex → progress
  progress: Record<string, Record<number, TopicProgress>>;
  totalMinutes: number;
  coachEnabled: boolean;
  createdAt: number;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "nexus-education-state";

function loadState(): EducationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state: EducationState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage full — ignore */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function totalCompleted(progress: EducationState["progress"]): number {
  return Object.values(progress).reduce(
    (sum, mod) => sum + Object.values(mod).filter((t) => t.completed).length,
    0
  );
}

function totalTopics(curriculum: Curriculum | null): number {
  return curriculum?.modules.reduce((s, m) => s + m.topics.length, 0) ?? 0;
}

function avgQuiz(progress: EducationState["progress"]): number | null {
  const scores: number[] = [];
  Object.values(progress).forEach((mod) =>
    Object.values(mod).forEach((t) => {
      if (t.quizScore !== null) scores.push(t.quizScore);
    })
  );
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ─── Component ────────────────────────────────────────────────────────────────

type View = "setup" | "curriculum" | "lesson" | "quiz";

export default function EducationPage() {
  // ── Persisted state ──
  const [eduState, setEduState] = useState<EducationState | null>(null);
  const [mounted, setMounted] = useState(false);

  // ── UI state (not persisted) ──
  const [view, setView] = useState<View>("setup");
  const [subjectInput, setSubjectInput] = useState("");
  const [level, setLevel] = useState<"Beginner" | "Intermediate" | "Advanced">("Beginner");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Active lesson
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [activeModuleKey, setActiveModuleKey] = useState<string>("");
  const [activeTopicIdx, setActiveTopicIdx] = useState(0);
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [lessonTab, setLessonTab] = useState<"lesson" | "practice" | "challenge">("lesson");
  const [showHint, setShowHint] = useState(false);

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Coach
  const [coachHint, setCoachHint] = useState<string | null>(null);
  const coachTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lessonStartRef = useRef<number>(Date.now());

  // ── Load from localStorage on mount ──
  useEffect(() => {
    setMounted(true);
    const saved = loadState();
    if (saved) {
      setEduState(saved);
      setSubjectInput(saved.subject);
      setLevel(saved.level);
      setGoal(saved.goal);
      if (saved.curriculum) setView("curriculum");
    }
  }, []);

  // ── Persist any time eduState changes ──
  useEffect(() => {
    if (eduState) saveState(eduState);
  }, [eduState]);

  // ── Coach interval ──
  useEffect(() => {
    if (!eduState?.coachEnabled || view !== "lesson" || !activeModule) return;

    coachTimerRef.current = setInterval(async () => {
      try {
        const completedTopics = Object.entries(eduState.progress[activeModule.id] ?? {})
          .filter(([, v]) => v.completed)
          .map(([i]) => activeModule.topics[Number(i)]);

        const res = await fetch("/api/education/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: eduState.subject,
            level: eduState.level,
            currentTopic: activeModule.topics[activeTopicIdx],
            completedTopics,
          }),
        });
        if (res.ok) {
          const { hint } = await res.json();
          setCoachHint(hint);
        }
      } catch { /* ignore */ }
    }, 90_000); // 90 seconds

    return () => {
      if (coachTimerRef.current) clearInterval(coachTimerRef.current);
    };
  }, [eduState?.coachEnabled, view, activeModule, activeTopicIdx]);

  // ── Track time spent on lessons ──
  useEffect(() => {
    if (view === "lesson") {
      lessonStartRef.current = Date.now();
    } else if (view === "curriculum" && activeModule) {
      const elapsed = Math.round((Date.now() - lessonStartRef.current) / 60_000);
      if (elapsed > 0) {
        setEduState((prev) => {
          if (!prev) return prev;
          const modProgress = { ...(prev.progress[activeModuleKey] ?? {}) };
          const existing = modProgress[activeTopicIdx] ?? { completed: false, quizScore: null, timeSpentMinutes: 0 };
          modProgress[activeTopicIdx] = { ...existing, timeSpentMinutes: existing.timeSpentMinutes + elapsed };
          return {
            ...prev,
            progress: { ...prev.progress, [activeModuleKey]: modProgress },
            totalMinutes: prev.totalMinutes + elapsed,
          };
        });
      }
    }
  }, [view]);

  // ── Generate curriculum ──
  async function handleGenerateCurriculum() {
    if (!subjectInput.trim() || !goal) return;
    setLoading(true);
    setError(null);
    setLoadingMsg("Generating your curriculum…");

    try {
      const res = await fetch("/api/education/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subjectInput.trim(), level, goal }),
      });
      if (!res.ok) throw new Error("Failed to generate curriculum");
      const { curriculum } = await res.json();

      const newState: EducationState = {
        subject: subjectInput.trim(),
        level,
        goal,
        curriculum,
        progress: {},
        totalMinutes: 0,
        coachEnabled: false,
        createdAt: Date.now(),
      };
      setEduState(newState);
      setView("curriculum");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Open a lesson ──
  async function handleOpenLesson(mod: Module, topicIdx: number, modKey: string) {
    setActiveModule(mod);
    setActiveModuleKey(modKey);
    setActiveTopicIdx(topicIdx);
    setLesson(null);
    setLessonTab("lesson");
    setShowHint(false);
    setCoachHint(null);
    setQuizAnswers([]);
    setQuizSubmitted(false);
    setView("lesson");
    setLoading(true);
    setLoadingMsg("Generating lesson content…");

    try {
      const res = await fetch("/api/education/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: eduState!.subject,
          level: eduState!.level,
          moduleTitle: mod.title,
          topic: mod.topics[topicIdx],
        }),
      });
      if (!res.ok) throw new Error("Failed to generate lesson");
      const { lesson: lessonData } = await res.json();
      setLesson(lessonData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Mark topic complete ──
  function markComplete() {
    if (!activeModule) return;
    setEduState((prev) => {
      if (!prev) return prev;
      const modProgress = { ...(prev.progress[activeModuleKey] ?? {}) };
      const existing = modProgress[activeTopicIdx] ?? { completed: false, quizScore: null, timeSpentMinutes: 0 };
      modProgress[activeTopicIdx] = { ...existing, completed: true };
      return { ...prev, progress: { ...prev.progress, [activeModuleKey]: modProgress } };
    });
    setView("curriculum");
  }

  // ── Start quiz ──
  function handleStartQuiz() {
    setQuizAnswers(new Array(lesson!.quiz.length).fill(null));
    setQuizSubmitted(false);
    setView("quiz");
  }

  // ── Submit quiz ──
  function handleSubmitQuiz() {
    if (!lesson || !activeModule) return;
    const correct = quizAnswers.filter((a, i) => a === lesson.quiz[i].correct).length;
    const score = Math.round((correct / lesson.quiz.length) * 100);
    setQuizSubmitted(true);

    setEduState((prev) => {
      if (!prev) return prev;
      const modProgress = { ...(prev.progress[activeModuleKey] ?? {}) };
      const existing = modProgress[activeTopicIdx] ?? { completed: false, quizScore: null, timeSpentMinutes: 0 };
      modProgress[activeTopicIdx] = {
        ...existing,
        completed: true,
        quizScore: Math.max(existing.quizScore ?? 0, score),
      };
      return { ...prev, progress: { ...prev.progress, [activeModuleKey]: modProgress } };
    });
  }

  // ── Reset / start over ──
  function handleReset() {
    localStorage.removeItem(STORAGE_KEY);
    setEduState(null);
    setSubjectInput("");
    setLevel("Beginner");
    setGoal("");
    setView("setup");
    setLesson(null);
    setActiveModule(null);
    setError(null);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (!mounted) return null;

  const completed = eduState ? totalCompleted(eduState.progress) : 0;
  const total = eduState ? totalTopics(eduState.curriculum) : 0;
  const quizAvg = eduState ? avgQuiz(eduState.progress) : null;
  const hours = eduState ? (eduState.totalMinutes / 60).toFixed(1) : "0.0";

  // ── SETUP VIEW ──
  if (view === "setup") {
    const quickSubjects = ["Python", "JavaScript", "Java", "Data Structures", "Machine Learning", "Calculus", "Cybersecurity", "Japanese"];
    const goals = [
      { label: "Pass my class", value: "pass my class" },
      { label: "Build projects", value: "build real projects" },
      { label: "Get job ready", value: "get job ready" },
      { label: "Interview prep", value: "prepare for technical interviews" },
      { label: "Learn for fun", value: "learn for fun and personal growth" },
    ];

    return (
      <div style={{ height: "100%", overflowY: "auto", padding: "32px 40px", background: "#0a0a0a" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#00f5ff", fontFamily: "monospace", marginBottom: 8 }}>
              NEXUS EDUCATION
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#fff", margin: 0 }}>
              What do you want to learn?
            </h1>
            <p style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
              Sam will generate a personalized curriculum and teach you — lesson by lesson.
            </p>
          </div>

          {/* Quick picks */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 10, letterSpacing: 1 }}>POPULAR SUBJECTS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {quickSubjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubjectInput(s)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: `1px solid ${subjectInput === s ? "#00f5ff" : "#333"}`,
                    background: subjectInput === s ? "rgba(0,245,255,0.1)" : "rgba(255,255,255,0.03)",
                    color: subjectInput === s ? "#00f5ff" : "#aaa",
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Subject input */}
          <input
            value={subjectInput}
            onChange={(e) => setSubjectInput(e.target.value)}
            placeholder="Or type any subject…"
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#fff",
              fontSize: 15,
              outline: "none",
              marginBottom: 24,
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => e.key === "Enter" && goal && handleGenerateCurriculum()}
          />

          {/* Skill level */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 10, letterSpacing: 1 }}>SKILL LEVEL</div>
            <div style={{ display: "flex", gap: 10 }}>
              {(["Beginner", "Intermediate", "Advanced"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    border: `1px solid ${level === l ? "#00f5ff" : "#333"}`,
                    background: level === l ? "rgba(0,245,255,0.1)" : "rgba(255,255,255,0.03)",
                    color: level === l ? "#00f5ff" : "#888",
                    fontSize: 14,
                    fontWeight: level === l ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 10, letterSpacing: 1 }}>YOUR GOAL</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {goals.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGoal(g.value)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: `1px solid ${goal === g.value ? "#00f5ff" : "#333"}`,
                    background: goal === g.value ? "rgba(0,245,255,0.1)" : "rgba(255,255,255,0.03)",
                    color: goal === g.value ? "#00f5ff" : "#888",
                    fontSize: 14,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(255,85,85,0.1)", border: "1px solid #ff555544", borderRadius: 8, color: "#ff5555", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGenerateCurriculum}
            disabled={!subjectInput.trim() || !goal || loading}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 10,
              border: "none",
              background: !subjectInput.trim() || !goal ? "#1a1a1a" : "linear-gradient(135deg, #00f5ff22, #0066ff22)",
              borderTop: "1px solid",
              borderColor: !subjectInput.trim() || !goal ? "#333" : "#00f5ff44",
              color: !subjectInput.trim() || !goal ? "#444" : "#00f5ff",
              fontSize: 15,
              fontWeight: 600,
              cursor: !subjectInput.trim() || !goal ? "not-allowed" : "pointer",
            }}
          >
            {loading ? loadingMsg : "Generate My Curriculum →"}
          </button>
        </div>
      </div>
    );
  }

  // ── CURRICULUM VIEW ──
  if (view === "curriculum" && eduState?.curriculum) {
    const curriculum = eduState.curriculum;

    return (
      <div style={{ height: "100%", overflowY: "auto", padding: "24px 32px", background: "#0a0a0a" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#00f5ff", fontFamily: "monospace", marginBottom: 4 }}>
              LEARNING PATH
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>{curriculum.title}</h1>
            <p style={{ color: "#666", fontSize: 13, marginTop: 4 }}>{curriculum.description}</p>
          </div>
          <button
            onClick={handleReset}
            style={{ padding: "6px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid #333", borderRadius: 6, color: "#666", fontSize: 12, cursor: "pointer" }}
          >
            New Course
          </button>
        </div>

        {/* Analytics strip */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          {[
            { label: "LESSONS", value: `${completed} / ${total}` },
            { label: "QUIZ AVG", value: quizAvg !== null ? `${quizAvg}%` : "—" },
            { label: "TIME", value: `${hours}h` },
            { label: "LEVEL", value: eduState.level },
          ].map((s) => (
            <div
              key={s.label}
              style={{ flex: 1, padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid #222", borderRadius: 8 }}
            >
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#00f5ff", fontFamily: "monospace" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Overall progress bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${total > 0 ? (completed / total) * 100 : 0}%`, background: "linear-gradient(90deg, #00f5ff, #0066ff)", transition: "width 0.4s ease" }} />
          </div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{Math.round(total > 0 ? (completed / total) * 100 : 0)}% complete</div>
        </div>

        {/* Coach toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, padding: "10px 16px", background: "rgba(0,245,255,0.04)", border: "1px solid #00f5ff22", borderRadius: 8 }}>
          <span style={{ fontSize: 18 }}>🧠</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Coach Mode</div>
            <div style={{ color: "#555", fontSize: 12 }}>Sam gives you hints every 90s while you work</div>
          </div>
          <button
            onClick={() => setEduState((prev) => prev ? { ...prev, coachEnabled: !prev.coachEnabled } : prev)}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: `1px solid ${eduState.coachEnabled ? "#00f5ff" : "#333"}`,
              background: eduState.coachEnabled ? "rgba(0,245,255,0.15)" : "transparent",
              color: eduState.coachEnabled ? "#00f5ff" : "#666",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {eduState.coachEnabled ? "ON" : "OFF"}
          </button>
        </div>

        {/* Modules */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {curriculum.modules.map((mod, mIdx) => {
            const modKey = mod.id ?? String(mIdx);
            const modDone = mod.topics.filter((_, tIdx) => eduState.progress[modKey]?.[tIdx]?.completed).length;
            const allDone = modDone === mod.topics.length;
            return (
              <div
                key={mod.id ?? mIdx}
                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${allDone ? "#00f5ff33" : "#222"}`, borderRadius: 10, overflow: "hidden" }}
              >
                {/* Module header */}
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: allDone ? "rgba(0,245,255,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${allDone ? "#00f5ff" : "#333"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: allDone ? "#00f5ff" : "#666", fontFamily: "monospace",
                  }}>
                    {allDone ? "✓" : mIdx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>{mod.title}</div>
                    <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{mod.description}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#444", fontFamily: "monospace" }}>
                    {modDone}/{mod.topics.length} · {mod.estimatedHours}h
                  </div>
                </div>

                {/* Topics */}
                <div style={{ padding: "8px 0" }}>
                  {mod.topics.map((topic, tIdx) => {
                    const topicProg = eduState.progress[modKey]?.[tIdx];
                    const done = topicProg?.completed ?? false;
                    const score = topicProg?.quizScore;
                    return (
                      <div
                        key={tIdx}
                        onClick={() => handleOpenLesson(mod, tIdx, modKey)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 18px",
                          cursor: "pointer",
                          transition: "background 0.15s",
                          borderBottom: tIdx < mod.topics.length - 1 ? "1px solid #111" : "none",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%",
                          background: done ? "rgba(0,245,255,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${done ? "#00f5ff" : "#2a2a2a"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: done ? "#00f5ff" : "#444", flexShrink: 0,
                        }}>
                          {done ? "✓" : ""}
                        </div>
                        <span style={{ color: done ? "#aaa" : "#ccc", fontSize: 14, flex: 1 }}>{topic}</span>
                        {score !== undefined && score !== null && (
                          <span style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: score >= 80 ? "rgba(76,255,138,0.1)" : score >= 60 ? "rgba(255,200,0,0.1)" : "rgba(255,85,85,0.1)",
                            color: score >= 80 ? "#4cff8a" : score >= 60 ? "#ffc800" : "#ff5555",
                            fontFamily: "monospace",
                          }}>
                            {score}%
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "#444" }}>→</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── LESSON VIEW ──
  if (view === "lesson" && activeModule) {
    const topic = activeModule.topics[activeTopicIdx];

    return (
      <div style={{ height: "100%", overflowY: "auto", padding: "24px 32px", background: "#0a0a0a" }}>
        {/* Back */}
        <button
          onClick={() => setView("curriculum")}
          style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer", marginBottom: 20, padding: 0 }}
        >
          ← Back to curriculum
        </button>

        {/* Coach hint banner */}
        {coachHint && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 16px", marginBottom: 16,
            background: "rgba(0,102,255,0.08)", border: "1px solid #0066ff44", borderRadius: 8,
          }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <span style={{ color: "#80aaff", fontSize: 14, flex: 1 }}>{coachHint}</span>
            <button onClick={() => setCoachHint(null)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Lesson header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 4 }}>{activeModule.title.toUpperCase()}</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>{topic}</h2>
        </div>

        {loading ? (
          <div style={{ color: "#555", fontSize: 14, padding: "40px 0", textAlign: "center" }}>{loadingMsg}</div>
        ) : lesson ? (
          <>
            {/* Tab bar */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1a1a1a", paddingBottom: 0 }}>
              {(["lesson", "practice", "challenge"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setLessonTab(tab); setShowHint(false); }}
                  style={{
                    padding: "8px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: `2px solid ${lessonTab === tab ? "#00f5ff" : "transparent"}`,
                    color: lessonTab === tab ? "#00f5ff" : "#555",
                    fontSize: 13,
                    fontWeight: lessonTab === tab ? 600 : 400,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Lesson tab */}
            {lessonTab === "lesson" && (
              <div>
                {/* Explanation */}
                <div style={{ color: "#ccc", fontSize: 15, lineHeight: 1.7, marginBottom: 24, whiteSpace: "pre-wrap" }}>
                  {lesson.explanation}
                </div>

                {/* Example */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, color: "#555", letterSpacing: 2, marginBottom: 8 }}>EXAMPLE</div>
                  <div style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>{lesson.example.description}</div>
                  <pre style={{
                    background: "#0d0d0d", border: "1px solid #222", borderRadius: 8,
                    padding: "16px", overflowX: "auto", fontSize: 13, color: "#e0e0e0",
                    fontFamily: "monospace", margin: 0, lineHeight: 1.6,
                  }}>
                    <code>{lesson.example.code}</code>
                  </pre>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleStartQuiz}
                    style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #00f5ff44", background: "rgba(0,245,255,0.08)", color: "#00f5ff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                  >
                    Take Quiz
                  </button>
                  <button
                    onClick={markComplete}
                    style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #333", background: "rgba(255,255,255,0.04)", color: "#888", fontSize: 14, cursor: "pointer" }}
                  >
                    Mark Complete
                  </button>
                </div>
              </div>
            )}

            {/* Practice tab */}
            {lessonTab === "practice" && (
              <div>
                <div style={{ color: "#ccc", fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>{lesson.practice.prompt}</div>
                <button
                  onClick={() => setShowHint(!showHint)}
                  style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #333", background: "transparent", color: "#888", fontSize: 13, cursor: "pointer", marginBottom: 12 }}
                >
                  {showHint ? "Hide hint" : "Show hint"}
                </button>
                {showHint && (
                  <div style={{ padding: "12px 16px", background: "rgba(0,102,255,0.06)", border: "1px solid #0066ff33", borderRadius: 8, color: "#80aaff", fontSize: 13 }}>
                    💡 {lesson.practice.hint}
                  </div>
                )}
              </div>
            )}

            {/* Challenge tab */}
            {lessonTab === "challenge" && (
              <div>
                <div style={{ fontSize: 12, color: "#ffc800", letterSpacing: 2, marginBottom: 12 }}>⚡ CHALLENGE</div>
                <div style={{ color: "#ccc", fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>{lesson.challenge.prompt}</div>
                <button
                  onClick={() => setShowHint(!showHint)}
                  style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #333", background: "transparent", color: "#888", fontSize: 13, cursor: "pointer", marginBottom: 12 }}
                >
                  {showHint ? "Hide hint" : "Show hint"}
                </button>
                {showHint && (
                  <div style={{ padding: "12px 16px", background: "rgba(255,200,0,0.05)", border: "1px solid #ffc80033", borderRadius: 8, color: "#ffc800", fontSize: 13 }}>
                    💡 {lesson.challenge.hint}
                  </div>
                )}
              </div>
            )}
          </>
        ) : error ? (
          <div style={{ color: "#ff5555", fontSize: 14 }}>{error}</div>
        ) : null}
      </div>
    );
  }

  // ── QUIZ VIEW ──
  if (view === "quiz" && lesson && activeModule) {
    const quizScore = quizSubmitted
      ? Math.round((quizAnswers.filter((a, i) => a === lesson.quiz[i].correct).length / lesson.quiz.length) * 100)
      : null;

    return (
      <div style={{ height: "100%", overflowY: "auto", padding: "24px 32px", background: "#0a0a0a" }}>
        <button
          onClick={() => setView("lesson")}
          style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer", marginBottom: 20, padding: 0 }}
        >
          ← Back to lesson
        </button>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 4 }}>QUIZ</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>{activeModule.topics[activeTopicIdx]}</h2>
        </div>

        {quizSubmitted && quizScore !== null && (
          <div style={{
            padding: "16px 20px", marginBottom: 24, borderRadius: 10,
            background: quizScore >= 80 ? "rgba(76,255,138,0.08)" : quizScore >= 60 ? "rgba(255,200,0,0.08)" : "rgba(255,85,85,0.08)",
            border: `1px solid ${quizScore >= 80 ? "#4cff8a44" : quizScore >= 60 ? "#ffc80044" : "#ff555544"}`,
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: quizScore >= 80 ? "#4cff8a" : quizScore >= 60 ? "#ffc800" : "#ff5555", fontFamily: "monospace" }}>
              {quizScore}%
            </div>
            <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
              {quizScore >= 80 ? "Excellent! Ready to move on." : quizScore >= 60 ? "Good effort — review the lesson and try again." : "Keep studying — review the lesson and retry."}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {lesson.quiz.map((q, qIdx) => {
            const answered = quizAnswers[qIdx];
            const isCorrect = quizSubmitted && answered === q.correct;
            const isWrong = quizSubmitted && answered !== null && answered !== q.correct;
            return (
              <div key={qIdx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #222", borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  {qIdx + 1}. {q.question}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {q.options.map((opt, oIdx) => {
                    let bg = "rgba(255,255,255,0.03)";
                    let border = "#2a2a2a";
                    let color = "#aaa";
                    if (!quizSubmitted && answered === oIdx) { bg = "rgba(0,102,255,0.1)"; border = "#0066ff44"; color = "#80aaff"; }
                    if (quizSubmitted && oIdx === q.correct) { bg = "rgba(76,255,138,0.1)"; border = "#4cff8a44"; color = "#4cff8a"; }
                    if (quizSubmitted && answered === oIdx && oIdx !== q.correct) { bg = "rgba(255,85,85,0.1)"; border = "#ff555544"; color = "#ff5555"; }
                    return (
                      <button
                        key={oIdx}
                        disabled={quizSubmitted}
                        onClick={() => {
                          const next = [...quizAnswers];
                          next[qIdx] = oIdx;
                          setQuizAnswers(next);
                        }}
                        style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${border}`, background: bg, color, fontSize: 13, textAlign: "left", cursor: quizSubmitted ? "default" : "pointer", transition: "all 0.15s" }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          {!quizSubmitted ? (
            <button
              onClick={handleSubmitQuiz}
              disabled={quizAnswers.some((a) => a === null)}
              style={{
                padding: "12px 24px", borderRadius: 8,
                border: "1px solid #00f5ff44", background: "rgba(0,245,255,0.08)",
                color: quizAnswers.some((a) => a === null) ? "#444" : "#00f5ff",
                fontSize: 14, fontWeight: 600, cursor: quizAnswers.some((a) => a === null) ? "not-allowed" : "pointer",
              }}
            >
              Submit Quiz
            </button>
          ) : (
            <>
              <button
                onClick={() => setView("curriculum")}
                style={{ padding: "12px 24px", borderRadius: 8, border: "1px solid #00f5ff44", background: "rgba(0,245,255,0.08)", color: "#00f5ff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Back to Curriculum
              </button>
              <button
                onClick={() => { setQuizAnswers(new Array(lesson.quiz.length).fill(null)); setQuizSubmitted(false); }}
                style={{ padding: "12px 24px", borderRadius: 8, border: "1px solid #333", background: "rgba(255,255,255,0.04)", color: "#888", fontSize: 14, cursor: "pointer" }}
              >
                Retry Quiz
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}