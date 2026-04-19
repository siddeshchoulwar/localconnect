import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, Loader2, ArrowRight, MapPin } from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && typeof user === "object") return <Navigate to="/feed" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const res = await login(form.email, form.password);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
    } else {
      navigate("/feed");
    }
  };

  const useDemo = () => {
    setForm({ email: "aanya@demo.com", password: "demo123" });
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5] flex items-center justify-center p-4 relative overflow-hidden">
      {/* decorative grid dots */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#111111 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="w-full max-w-md relative">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-[#FF5E5E] border-2 border-[#111111] brut-shadow flex items-center justify-center">
              <MapPin size={24} strokeWidth={2.75} className="text-white" />
            </div>
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl tracking-tighter leading-none">
            Welcome <span className="bg-[#FFE973] border-2 border-[#111111] px-2 inline-block">back</span>
          </h1>
          <p className="mt-3 font-medium text-[#8A8A8A] text-sm">Sign in to your neighbourhood feed</p>
        </div>

        <form
          onSubmit={submit}
          data-testid="login-form"
          className="bg-white border-2 border-[#111111] brut-shadow p-6"
        >
          <label className="block mb-4">
            <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Email</span>
            <div className="relative">
              <Mail size={16} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
              <input
                data-testid="login-email-input"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@area.local"
                className="w-full border-2 border-[#111111] bg-white pl-9 pr-3 py-3 font-medium focus:outline-none focus:bg-[#FFFDF5]"
              />
            </div>
          </label>

          <label className="block mb-4">
            <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Password</span>
            <div className="relative">
              <Lock size={16} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
              <input
                data-testid="login-password-input"
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full border-2 border-[#111111] bg-white pl-9 pr-3 py-3 font-medium focus:outline-none focus:bg-[#FFFDF5]"
              />
            </div>
          </label>

          {err && (
            <div
              data-testid="login-error"
              className="bg-[#FF5E5E] text-white border-2 border-[#111111] p-3 mb-4 font-bold text-sm"
            >
              {err}
            </div>
          )}

          <button
            type="submit"
            data-testid="login-submit-btn"
            disabled={busy}
            className="w-full bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow brut-press py-3 font-heading font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} strokeWidth={3} />}
            Sign in
          </button>

          <button
            type="button"
            onClick={useDemo}
            data-testid="login-demo-btn"
            className="w-full mt-3 bg-[#C4A1FF] text-[#111111] border-2 border-[#111111] brut-shadow-sm brut-press py-2.5 font-heading font-black uppercase tracking-wider text-xs"
          >
            ✨ Try Demo Account
          </button>

          <p className="mt-5 text-center text-sm font-medium">
            New to the block?{" "}
            <Link to="/signup" data-testid="link-to-signup" className="font-black underline underline-offset-4 decoration-[3px] decoration-[#FF5E5E]">
              Create account
            </Link>
          </p>
        </form>

        <p className="text-center mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8A8A]">
          ★ Built for your neighbourhood ★
        </p>
      </div>
    </div>
  );
}
