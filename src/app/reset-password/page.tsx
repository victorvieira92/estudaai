"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("As senhas nao coincidem."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.message ?? "Erro ao redefinir."); setLoading(false); return; }
    setSuccess(true);
    setTimeout(() => router.push("/login"), 3000);
    setLoading(false);
  };

  if (!token) return (
    <div className="text-center">
      <p className="text-red-600 font-medium">Link invalido.</p>
      <a href="/login" className="text-blue-600 text-sm mt-2 block">Voltar ao login</a>
    </div>
  );

  if (success) return (
    <div className="text-center">
      <div className="text-5xl mb-4">✅</div>
      <p className="text-green-700 font-semibold text-lg">Senha redefinida!</p>
      <p className="text-gray-500 text-sm mt-1">Redirecionando para o login...</p>
    </div>
  );

  return (
    <form onSubmit={handle} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">Nova senha</h2>
        <p className="text-gray-500 text-sm">Digite e confirme sua nova senha.</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Nova senha</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Minimo 6 caracteres"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Confirmar senha</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} placeholder="Repita a senha"
          className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${confirm && password !== confirm ? "border-red-300 bg-red-50" : "border-gray-300"}`} />
        {confirm && password !== confirm && <p className="text-xs text-red-600 mt-1">As senhas nao coincidem</p>}
      </div>
      {error && <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
        {loading ? "Salvando..." : "Redefinir senha"}
      </button>
      <a href="/login" className="block text-center text-sm text-gray-500 hover:text-gray-700">Voltar ao login</a>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">EstudaAi</h1>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <Suspense fallback={<div className="text-center text-gray-500">Carregando...</div>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
