"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export type TimerState = "idle" | "running" | "paused";

const STORAGE_KEY = "estudaai_timer";

interface PersistedTimer {
  state:       TimerState;
  accumulated: number;
  startedAt:   number | null;
}

function load(): PersistedTimer {
  if (typeof window === "undefined") return { state: "idle", accumulated: 0, startedAt: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: "idle", accumulated: 0, startedAt: null };
    return JSON.parse(raw) as PersistedTimer;
  } catch { return { state: "idle", accumulated: 0, startedAt: null }; }
}

function save(data: PersistedTimer) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clear() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}

function calcElapsed(p: PersistedTimer): number {
  let total = p.accumulated;
  if (p.state === "running" && p.startedAt)
    total += Math.floor((Date.now() - p.startedAt) / 1000);
  return total;
}

export function useStudyTimer() {
  const [persisted, setPersisted] = useState<PersistedTimer>(() => load());
  const [elapsed, setElapsed]     = useState<number>(() => calcElapsed(load()));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { state } = persisted;

  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (state === "running") {
      intervalRef.current = setInterval(() => setElapsed(calcElapsed(persisted)), 500);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, persisted.startedAt]);

  useEffect(() => {
    const p = load(); setPersisted(p); setElapsed(calcElapsed(p));
  }, []);

  const update = (next: PersistedTimer) => { save(next); setPersisted(next); setElapsed(calcElapsed(next)); };

  const start  = useCallback(() => update({ state: "running", accumulated: 0, startedAt: Date.now() }), []);
  const pause  = useCallback(() => { if (state !== "running") return; update({ state: "paused", accumulated: calcElapsed(persisted), startedAt: null }); }, [state, persisted]);
  const resume = useCallback(() => { if (state !== "paused") return; update({ state: "running", accumulated: persisted.accumulated, startedAt: Date.now() }); }, [state, persisted]);
  const stop   = useCallback((): number => { const final = calcElapsed(persisted); clear(); setPersisted({ state: "idle", accumulated: 0, startedAt: null }); setElapsed(0); return final; }, [persisted]);
  const reset  = useCallback(() => { clear(); setPersisted({ state: "idle", accumulated: 0, startedAt: null }); setElapsed(0); }, []);

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return { state, elapsed, formatted: `${hh}:${mm}:${ss}`, hoursDecimal: elapsed / 3600, start, pause, resume, stop, reset };
}
