"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export type TimerState = "idle" | "running" | "paused" | "done";

const STORAGE_KEY = "estudaai_countdown";

interface PersistedCountdown {
  state:       TimerState;
  targetSecs:  number;
  remaining:   number;
  startedAt:   number | null;
}

function load(): PersistedCountdown {
  if (typeof window === "undefined")
    return { state: "idle", targetSecs: 25 * 60, remaining: 25 * 60, startedAt: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: "idle", targetSecs: 25 * 60, remaining: 25 * 60, startedAt: null };
    return JSON.parse(raw) as PersistedCountdown;
  } catch {
    return { state: "idle", targetSecs: 25 * 60, remaining: 25 * 60, startedAt: null };
  }
}

function save(data: PersistedCountdown) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearStorage() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}

function calcRemaining(p: PersistedCountdown): number {
  if (p.state !== "running" || !p.startedAt) return p.remaining;
  const elapsed = Math.floor((Date.now() - p.startedAt) / 1000);
  return Math.max(0, p.remaining - elapsed);
}

export function useCountdown() {
  const [persisted, setPersisted] = useState<PersistedCountdown>(() => load());
  const [remaining, setRemaining] = useState<number>(() => calcRemaining(load()));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { state, targetSecs } = persisted;

  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (state === "running") {
      intervalRef.current = setInterval(() => {
        const r = calcRemaining(persisted);
        setRemaining(r);
        if (r <= 0) {
          const done: PersistedCountdown = { ...persisted, state: "done", remaining: 0, startedAt: null };
          save(done); setPersisted(done); setRemaining(0);
          clearInterval(intervalRef.current!);
        }
      }, 500);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, persisted.startedAt]);

  useEffect(() => {
    const p = load(); setPersisted(p); setRemaining(calcRemaining(p));
  }, []);

  const update = (next: PersistedCountdown) => { save(next); setPersisted(next); setRemaining(calcRemaining(next)); };

  const setDuration = useCallback((mins: number) => {
    const secs = mins * 60;
    update({ state: "idle", targetSecs: secs, remaining: secs, startedAt: null });
  }, []);

  const start = useCallback(() => {
    update({ ...persisted, state: "running", startedAt: Date.now() });
  }, [persisted]);

  const pause = useCallback(() => {
    if (state !== "running") return;
    update({ ...persisted, state: "paused", remaining: calcRemaining(persisted), startedAt: null });
  }, [state, persisted]);

  const resume = useCallback(() => {
    if (state !== "paused") return;
    update({ ...persisted, state: "running", startedAt: Date.now() });
  }, [state, persisted]);

  const reset = useCallback(() => {
    clearStorage();
    const next: PersistedCountdown = { state: "idle", targetSecs, remaining: targetSecs, startedAt: null };
    setPersisted(next); setRemaining(targetSecs);
  }, [targetSecs]);

  const pct = targetSecs > 0 ? Math.round(((targetSecs - remaining) / targetSecs) * 100) : 0;
  const hh  = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const mm  = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const ss  = String(remaining % 60).padStart(2, "0");

  return {
    state, remaining, targetSecs, pct,
    formatted: `${hh}:${mm}:${ss}`,
    elapsedSeconds: targetSecs - remaining,
    start, pause, resume, reset, setDuration,
  };
}
