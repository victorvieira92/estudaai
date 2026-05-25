"use client";
import { useState, useEffect, useRef } from "react";
import { useStudyTimer } from "@/hooks/useStudyTimer";
import { useCountdown } from "@/hooks/useCountdown";
import { Play, Pause, RotateCcw, Timer, Clock, ChevronDown, Minus, X, GripHorizontal } from "lucide-react";

const BG = "#1B4040";
const TIMER_PRESETS = [15, 25, 30, 45, 50, 60, 90];

type ViewMode = "bubble" | "expanded" | "floating";

export function FloatingTimer() {
  const [view, setView]         = useState<ViewMode>("bubble");
  const [mode, setMode]         = useState<"cronometro" | "timer">("cronometro");
  const [timerMins, setTimerMins] = useState(25);
  const [mounted, setMounted]   = useState(false);
  const [pos, setPos]           = useState({ x: 20, y: 80 });
  const dragging   = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const timer     = useStudyTimer();
  const countdown = useCountdown();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const isRunning = mode === "cronometro" ? timer.state === "running" : countdown.state === "running";
  const isPaused  = mode === "cronometro" ? timer.state === "paused"  : countdown.state === "paused";
  const isIdle    = mode === "cronometro" ? timer.state === "idle"    : countdown.state === "idle";
  const isDone    = mode === "timer" && countdown.state === "done";
  const isActive  = !isIdle;
  const displayTime = mode === "cronometro" ? timer.formatted : countdown.formatted;

  const handleStart = () => {
    if (mode === "cronometro") {
      if (isIdle) timer.start(); else if (isPaused) timer.resume();
    } else {
      if (isIdle) { countdown.setDuration(timerMins); setTimeout(() => countdown.start(), 50); }
      else if (isPaused) countdown.resume();
      else if (isDone) { countdown.reset(); setTimeout(() => { countdown.setDuration(timerMins); setTimeout(() => countdown.start(), 50); }, 50); }
    }
  };
  const handlePause = () => { if (mode === "cronometro") timer.pause(); else countdown.pause(); };
  const handleReset = () => { if (mode === "cronometro") timer.reset(); else countdown.reset(); };

  // ── BUBBLE ────────────────────────────────────────────────────────────────
  if (view === "bubble") {
    return (
      <button onClick={() => setView("expanded")} title="Abrir timer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl text-white text-sm font-semibold transition-all hover:scale-105 active:scale-95"
        style={{ backgroundColor: BG, border: "2px solid rgba(255,255,255,0.15)" }}>
        {isRunning ? <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          : isDone ? <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          : isPaused ? <span className="w-2 h-2 rounded-full bg-yellow-300" />
          : <Timer size={14} />}
        <span className="font-mono tracking-wider">{displayTime}</span>
      </button>
    );
  }

  // ── FLOATING (janela arrastável) ──────────────────────────────────────────
  if (view === "floating") {
    const onMouseDown = (e: React.MouseEvent) => {
      dragging.current = true;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        setPos({ x: ev.clientX - dragOffset.current.x, y: ev.clientY - dragOffset.current.y });
      };
      const onUp = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    return (
      <div className="fixed z-50 rounded-2xl shadow-2xl text-white select-none"
        style={{ backgroundColor: BG, left: pos.x, top: pos.y, width: 240, border: "1px solid rgba(255,255,255,0.12)" }}>
        {/* Drag handle */}
        <div onMouseDown={onMouseDown}
          className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing border-b border-white/10">
          <div className="flex items-center gap-1.5 opacity-50">
            <GripHorizontal size={13} />
            <span className="text-[10px] uppercase tracking-widest">Timer</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setView("expanded")} title="Expandir"
              className="w-4 h-4 rounded-full bg-yellow-400 hover:bg-yellow-300 flex items-center justify-center transition-colors" />
            <button onClick={() => setView("bubble")} title="Fechar para bolinha"
              className="w-4 h-4 rounded-full bg-red-400 hover:bg-red-300 flex items-center justify-center transition-colors" />
          </div>
        </div>
        {/* Time */}
        <div className="text-center py-3 px-3">
          {isDone
            ? <p className="text-yellow-300 text-xs font-semibold animate-pulse">⏰ Finalizado!</p>
            : <span className="font-mono text-3xl font-bold tracking-widest">{displayTime}</span>}
          {mode === "timer" && isActive && !isDone && (
            <div className="mt-2 h-1 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-green-400 transition-all duration-500" style={{ width: `${countdown.pct}%` }} />
            </div>
          )}
        </div>
        {/* Controls */}
        <div className="flex justify-center gap-2 px-3 pb-3">
          {(isIdle || isDone) && (
            <button onClick={handleStart}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-green-500 hover:bg-green-400 transition-colors">
              <Play size={12} /> {isDone ? "Reiniciar" : "Iniciar"}
            </button>
          )}
          {isRunning && (
            <button onClick={handlePause}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500 hover:bg-yellow-400 transition-colors">
              <Pause size={12} /> Pausar
            </button>
          )}
          {isPaused && (
            <button onClick={handleStart}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-green-500 hover:bg-green-400 transition-colors">
              <Play size={12} /> Continuar
            </button>
          )}
          {isActive && (
            <button onClick={handleReset}
              className="flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── EXPANDED PANEL ────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-2xl shadow-2xl text-white overflow-hidden"
      style={{ backgroundColor: BG, width: 288, border: "1px solid rgba(255,255,255,0.1)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="font-semibold text-sm tracking-wide">⏱ Timer de Estudo</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("floating")} title="Janela suspensa"
            className="text-[10px] uppercase tracking-wide opacity-50 hover:opacity-100 border border-white/20 rounded px-1.5 py-0.5 transition-opacity">
            Pop-out
          </button>
          <button onClick={() => setView("bubble")} title="Minimizar"
            className="opacity-50 hover:opacity-100 transition-opacity">
            <Minus size={15} />
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex mx-4 mt-3 mb-2 rounded-lg overflow-hidden border border-white/20 text-xs font-medium">
        {(["cronometro", "timer"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors"
            style={{ backgroundColor: mode === m ? "rgba(255,255,255,0.18)" : "transparent" }}>
            {m === "cronometro" ? <Clock size={11} /> : <Timer size={11} />}
            {m === "cronometro" ? "Cronômetro" : "Timer"}
          </button>
        ))}
      </div>

      {/* Preset selector (timer idle only) */}
      {mode === "timer" && isIdle && (
        <div className="px-4 mb-2">
          <div className="relative">
            <select value={timerMins}
              onChange={e => { const v = Number(e.target.value); setTimerMins(v); countdown.setDuration(v); }}
              className="w-full appearance-none rounded-lg px-3 py-2 text-sm text-white pr-8"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
              {TIMER_PRESETS.map(m => <option key={m} value={m} className="text-black bg-white">{m} minutos</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Time display */}
      <div className="text-center py-4">
        {isDone
          ? <p className="text-yellow-300 text-sm font-semibold animate-pulse">⏰ Tempo finalizado!</p>
          : <span className="font-mono text-4xl font-bold tracking-widest">{displayTime}</span>}
        {mode === "timer" && isActive && !isDone && (
          <div className="mt-3 mx-4">
            <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-green-400 transition-all duration-500" style={{ width: `${countdown.pct}%` }} />
            </div>
          </div>
        )}
        <p className="text-[10px] mt-2 opacity-40 uppercase tracking-widest">
          {isRunning ? "● Rodando" : isPaused ? "⏸ Pausado" : isDone ? "" : "Pronto para iniciar"}
        </p>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3 px-4 pb-4">
        {(isIdle || isDone) && (
          <button onClick={handleStart}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-green-500 hover:bg-green-400 transition-colors">
            <Play size={15} /> {isDone ? "Reiniciar" : "Iniciar"}
          </button>
        )}
        {isRunning && (<>
          <button onClick={handlePause}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-yellow-500 hover:bg-yellow-400 transition-colors">
            <Pause size={15} /> Pausar
          </button>
          <button onClick={handleReset}
            className="flex items-center justify-center px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <RotateCcw size={15} />
          </button>
        </>)}
        {isPaused && (<>
          <button onClick={handleStart}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-green-500 hover:bg-green-400 transition-colors">
            <Play size={15} /> Continuar
          </button>
          <button onClick={handleReset}
            className="flex items-center justify-center px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <RotateCcw size={15} />
          </button>
        </>)}
      </div>
    </div>
  );
}
