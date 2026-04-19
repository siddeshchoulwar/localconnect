import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, Loader2, ArrowRight, MapPin, User, Store, Phone, Building2 } from "lucide-react";
import { BUSINESS_CATEGORIES } from "@/lib/utils-social";

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState("personal");
  const [form, setForm] = useState({
    name: "", email: "", password: "", area: "",
    phone: "", business_name: "", business_category: "food",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && typeof user === "object") return <Navigate to="/feed" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const payload = {
      name: form.name, email: form.email, password: form.password, area: form.area,
      account_type: accountType,
      phone: form.phone || null,
      business_name: accountType === "business" ? form.business_name : null,
      business_category: accountType === "business" ? form.business_category : null,
    };
    const res = await signup(payload);
    setBusy(false);
    if (!res.ok) setErr(res.error);
    else navigate("/feed");
  };

  const onChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-[#FFFDF5] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "radial-gradient(#111111 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      <div className="w-full max-w-md relative">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-[#C4A1FF] border-2 border-[#111111] brut-shadow flex items-center justify-center">
              <MapPin size={24} strokeWidth={2.75} />
            </div>
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl tracking-tighter leading-none">
            Join your <span className="bg-[#FF5E5E] text-white border-2 border-[#111111] px-2 inline-block">block</span>
          </h1>
          <p className="mt-3 font-medium text-[#8A8A8A] text-sm">Pick the account that fits you</p>
        </div>

        {/* Account type picker */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => setAccountType("personal")}
            data-testid="account-type-personal"
            className={`border-2 border-[#111111] p-4 text-left brut-press ${accountType === "personal" ? "bg-[#FF5E5E] text-white brut-shadow" : "bg-white"}`}
          >
            <User size={20} strokeWidth={2.75} />
            <div className="mt-2 font-heading font-black text-sm uppercase tracking-wider">Personal</div>
            <div className="text-[11px] font-semibold opacity-80 mt-0.5">Social feed · Events · Connect</div>
          </button>
          <button
            type="button"
            onClick={() => setAccountType("business")}
            data-testid="account-type-business"
            className={`border-2 border-[#111111] p-4 text-left brut-press ${accountType === "business" ? "bg-[#FFE973] brut-shadow" : "bg-white"}`}
          >
            <Store size={20} strokeWidth={2.75} />
            <div className="mt-2 font-heading font-black text-sm uppercase tracking-wider">Business</div>
            <div className="text-[11px] font-semibold opacity-80 mt-0.5">Shop listing · Products · Offers</div>
          </button>
        </div>

        <form onSubmit={submit} data-testid="signup-form" className="bg-white border-2 border-[#111111] brut-shadow p-5">
          <label className="block mb-3">
            <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Your name</span>
            <div className="relative">
              <User size={16} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
              <input data-testid="signup-name-input" required value={form.name} onChange={onChange("name")} placeholder={accountType === "business" ? "Your full name" : "Jane Doe"} className="w-full border-2 border-[#111111] bg-white pl-9 pr-3 py-2.5 font-medium focus:outline-none" />
            </div>
          </label>

          {accountType === "business" && (
            <>
              <label className="block mb-3">
                <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Business name</span>
                <div className="relative">
                  <Building2 size={16} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
                  <input data-testid="signup-business-name-input" required value={form.business_name} onChange={onChange("business_name")} placeholder="e.g. Brewberry Cafe" className="w-full border-2 border-[#111111] bg-white pl-9 pr-3 py-2.5 font-medium focus:outline-none" />
                </div>
              </label>
              <label className="block mb-3">
                <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Category</span>
                <select data-testid="signup-business-category" value={form.business_category} onChange={onChange("business_category")} className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none">
                  {BUSINESS_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                </select>
              </label>
              <label className="block mb-3">
                <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Phone (optional)</span>
                <div className="relative">
                  <Phone size={16} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
                  <input data-testid="signup-phone-input" value={form.phone} onChange={onChange("phone")} placeholder="+91 98100 00000" className="w-full border-2 border-[#111111] bg-white pl-9 pr-3 py-2.5 font-medium focus:outline-none" />
                </div>
              </label>
            </>
          )}

          <label className="block mb-3">
            <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Email</span>
            <div className="relative">
              <Mail size={16} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
              <input data-testid="signup-email-input" type="email" required value={form.email} onChange={onChange("email")} placeholder="you@area.local" className="w-full border-2 border-[#111111] bg-white pl-9 pr-3 py-2.5 font-medium focus:outline-none" />
            </div>
          </label>

          <label className="block mb-3">
            <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Password</span>
            <div className="relative">
              <Lock size={16} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
              <input data-testid="signup-password-input" type="password" required minLength={6} value={form.password} onChange={onChange("password")} placeholder="Min 6 characters" className="w-full border-2 border-[#111111] bg-white pl-9 pr-3 py-2.5 font-medium focus:outline-none" />
            </div>
          </label>

          <label className="block mb-4">
            <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Area / neighbourhood</span>
            <div className="relative">
              <MapPin size={16} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
              <input data-testid="signup-area-input" required value={form.area} onChange={onChange("area")} placeholder="Koramangala, Indiranagar…" className="w-full border-2 border-[#111111] bg-white pl-9 pr-3 py-2.5 font-medium focus:outline-none" />
            </div>
          </label>

          {err && <div data-testid="signup-error" className="bg-[#FF5E5E] text-white border-2 border-[#111111] p-3 mb-4 font-bold text-sm">{err}</div>}

          <button type="submit" data-testid="signup-submit-btn" disabled={busy} className="w-full bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow brut-press py-3 font-heading font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} strokeWidth={3} />}
            Create account
          </button>

          <p className="mt-4 text-center text-sm font-medium">
            Already have one? <Link to="/login" data-testid="link-to-login" className="font-black underline underline-offset-4 decoration-[3px] decoration-[#FF5E5E]">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
