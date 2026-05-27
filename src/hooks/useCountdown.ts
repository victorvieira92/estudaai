import { useState, useEffect, useRef, useCallback } from "react";

// ✅ FIX: chave prefixada com userId para isolamento multiusuário
function getStorageKey(userId?: string) {
  return userId ? `estudaai_countdown_${userId}` : "estudaai_countdown";
}

interface PersistedCountdown {
  targetMs: number;    // timestamp ms quando o countdown acaba
  totalSecs: number;   // duração total configurada (para a barra de progresso)
  running: boolean;
}

function load(userId?: string): PersistedCountdown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedCountdown;
  } catch { return null; }
}

function save(data: PersistedCountdown, userId?: string) {
  if (typeof window !== "undefined")
    localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
}

function clear(userId?: string) {
  if (typeof window !== "undefined")
    localStorage.removeItem(getStorageKey(userId));
}

export function useCountdown(userId?: string) {
  const [remaining, setRemaining] = useState(0);  // segundos restantes
  const [totalSecs, setTotalSecs] = useState(0);
  const [running,   setRunning]   = useState(false);
  const [finished,  setFinished]  = useState(false);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef                  = useRef<PersistedCountdown | null>(null);

  // Hidrata do localStorage na montagem
  useEffect(() => {
    const persisted = load(userId);
    if (!persisted) return;
    stateRef.current = persisted;
    setTotalSecs(persisted.totalSecs);
    if (persisted.running) {
      const rem = Math.max(0, Math.ceil((persisted.targetMs - Date.now()) / 1000));
      setRemaining(rem);
      if (rem > 0) setRunning(true);
      else setFinished(true);
    }
  }, [userId]);

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        if (!stateRef.current) return;
        const rem = Math.max(0, Math.ceil((stateRef.current.targetMs - Date.now()) / 1000));
        setRemaining(rem);
        if (rem <= 0) {
          setRunning(false);
          setFinished(true);
          clear(userId);
        }
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, userId]);

  const start = useCallback((secs: number) => {
    const targetMs = Date.now() + secs * 1000;
    const state: PersistedCountdown = { targetMs, totalSecs: secs, running: true };
    stateRef.current = state;
    save(state, userId);
    setTotalSecs(secs);
    setRemaining(secs);
    setRunning(true);
    setFinished(false);
  }, [userId]);

  const pause = useCallback(() => {
    if (!stateRef.current) return;
    // Salva o estado pausado guardando quanto falta
    const rem = Math.max(0, Math.ceil((stateRef.current.targetMs - Date.now()) / 1000));
    const state: PersistedCountdown = {
      targetMs:  Date.now() + rem * 1000,
      totalSecs: stateRef.current.totalSecs,
      running:   false,
    };
    stateRef.current = state;
    save(state, userId);
    setRunning(false);
  }, [userId]);

  const resume = useCallback(() => {
    if (!stateRef.current) return;
    const state: PersistedCountdown = {
      ...stateRef.current,
      targetMs: Date.now() + remaining * 1000,
      running:  true,
    };
    stateRef.current = state;
    save(state, userId);
    setRunning(true);
    setFinished(false);
  }, [remaining, userId]);

  const reset = useCallback(() => {
    clear(userId);
    stateRef.current = null;
    setRemaining(0);
    setTotalSecs(0);
    setRunning(false);
    setFinished(false);
  }, [userId]);

  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
    return [m, s].map(v => String(v).padStart(2, "0")).join(":");
  };

  const progress = totalSecs > 0 ? Math.round(((totalSecs - remaining) / totalSecs) * 100) : 0;

  return { remaining, totalSecs, running, finished, formatted: fmt(remaining), progress, start, pause, resume, reset };
}
