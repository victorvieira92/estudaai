import { useState, useEffect, useRef, useCallback } from "react";

// ✅ FIX: chave prefixada com userId para isolamento multiusuário
function getStorageKey(userId?: string) {
  return userId ? `estudaai_timer_${userId}` : "estudaai_timer";
}

interface PersistedTimer {
  startedAt: number;   // timestamp ms quando o timer foi iniciado
  accumulated: number; // segundos já acumulados antes de pausar
  running: boolean;
}

function load(userId?: string): PersistedTimer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimer;
  } catch { return null; }
}

function save(data: PersistedTimer, userId?: string) {
  if (typeof window !== "undefined")
    localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
}

function clear(userId?: string) {
  if (typeof window !== "undefined")
    localStorage.removeItem(getStorageKey(userId));
}

export function useStudyTimer(userId?: string) {
  const [elapsed, setElapsed]   = useState(0); // segundos totais
  const [running, setRunning]   = useState(false);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef                = useRef<PersistedTimer>({ startedAt: 0, accumulated: 0, running: false });

  // Hidrata do localStorage na montagem
  useEffect(() => {
    const persisted = load(userId);
    if (!persisted) return;
    stateRef.current = persisted;
    if (persisted.running) {
      const now  = Date.now();
      const diff = Math.floor((now - persisted.startedAt) / 1000);
      setElapsed(persisted.accumulated + diff);
      setRunning(true);
    } else {
      setElapsed(persisted.accumulated);
    }
  }, [userId]);

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        const now  = Date.now();
        const diff = Math.floor((now - stateRef.current.startedAt) / 1000);
        setElapsed(stateRef.current.accumulated + diff);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const start = useCallback(() => {
    const now = Date.now();
    stateRef.current = { startedAt: now, accumulated: elapsed, running: true };
    save(stateRef.current, userId);
    setRunning(true);
  }, [elapsed, userId]);

  const pause = useCallback(() => {
    stateRef.current = { ...stateRef.current, accumulated: elapsed, running: false };
    save(stateRef.current, userId);
    setRunning(false);
  }, [elapsed, userId]);

  const reset = useCallback(() => {
    clear(userId);
    stateRef.current = { startedAt: 0, accumulated: 0, running: false };
    setElapsed(0);
    setRunning(false);
  }, [userId]);

  // Formata HH:MM:SS
  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
  };

  return { elapsed, running, formatted: fmt(elapsed), start, pause, reset };
}
