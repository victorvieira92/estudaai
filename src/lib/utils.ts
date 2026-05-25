import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function safeFloat(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ✅ FIX: startOfToday usa fuso de Brasília (UTC-3)
// O servidor está em Washington DC (UTC-4/UTC-5), então new Date() sem ajuste
// causa revisões de 24h aparecerem no mesmo dia do estudo
export function startOfToday(): Date {
  // Pega a data atual em Brasília
  const nowBR     = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayBRStr = nowBR.toISOString().slice(0, 10); // "2026-05-25"
  // Retorna meia-noite de hoje no horário de Brasília como UTC
  return new Date(todayBRStr + "T00:00:00-03:00");
}

// ✅ Revisão de 24h: começa amanhã às 00:00 de Brasília
// Garante que nunca aparece no mesmo dia do estudo
export function startOfTomorrow(): Date {
  return addDays(startOfToday(), 1);
}

export function formatHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (hh === 0) return `${mm}min`;
  if (mm === 0) return `${hh}h`;
  return `${hh}h${mm}min`;
}

export function pct(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}
