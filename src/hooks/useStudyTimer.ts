"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export type TimerState = "idle" | "running" | "paused";

export function useStudyTimer() {
  const [state, setState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);

  const clear = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  useEffect(() => {
    if (state === "running") {
      startedAtRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        setElapsed(accumulatedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 500);
    } else { clear(); }
    return clear;
  }, [state]);

  const start = useCallback(() => { accumulatedRef.current = 0; setElapsed(0); setState("running"); }, []);
  const pause = useCallback(() => {
    if (state !== "running") return;
    accumulatedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000);
    setState("paused");
  }, [state]);
  const resume = useCallback(() => { if (state === "paused") setState("running"); }, [state]);
  const stop = useCallback((): number => {
    let final = accumulatedRef.current;
    if (state === "running") final += Math.floor((Date.now() - startedAtRef.current) / 1000);
    clear(); accumulatedRef.current = 0; setElapsed(0); setState("idle");
    return final;
  }, [state]);
  const reset = useCallback(() => { clear(); accumulatedRef.current = 0; setElapsed(0); setState("idle"); }, []);

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return { state, elapsed, formatted: `${hh}:${mm}:${ss}`, hoursDecimal: elapsed / 3600, start, pause, resume, stop, reset };
}
