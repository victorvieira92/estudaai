"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register" | "forgot">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.ok) router.push("/dashboard");
    else setError("Email ou senha invalidos.");
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.message ?? "Erro ao cadastrar."); setLoading(false); return; }
    const login = await signIn("credentials", { email, password, redirect: false });
    if (login?.ok) router.push("/dashboard");
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSuccess("Se o email estiver cadastrado, voce receberá um link em breve.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">EstudaAi</h1>
          <p className="text-gray-400 mt-2">Sua plataforma de concursos</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl">
          {tab !== "forgot" && (
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              {(["login", "register"] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setError(""); setSuccess(""); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  {t === "login" ? "Entrar" : "Criar conta"}
                </button>
              ))}
            </div>
          )}

          {tab === "forgot" && (
            <div className="mb-6">
              <button onClick={() => { setTab("login"); setError(""); setSuccess(""); }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                ← Voltar ao login
              </button>
              <h2 className="text-xl font-semibold mt-3 mb-1">Esqueci minha senha</h2>
              <p className="text-gray-500 text-sm">Digite seu email e enviaremos um link para redefinir sua senha.</p>
            </div>
          )}

          <form onSubmit={tab === "login" ? handleLogin : tab === "register" ? handleRegister : handleForgot} className="space-y-4">
            {tab === "register" && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Nome</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Seu nome completo"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>

            {tab !== "forgot" && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            )}

            {error && <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
            {success && <p className="text-green-700 text-sm bg-green-50 px-4 py-3 rounded-xl">{success}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              {loading ? "Aguarde..." : tab === "login" ? "Entrar" : tab === "register" ? "Criar conta" : "Enviar link"}
            </button>

            {tab === "login" && (
              <button type="button" onClick={() => { setTab("forgot"); setError(""); setSuccess(""); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 text-center mt-1">
                Esqueci minha senha
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
