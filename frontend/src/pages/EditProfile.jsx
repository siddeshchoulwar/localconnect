import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import Avatar from "@/components/Avatar";
import { api, uploadImage, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getBrowserLocation, formatDistance } from "@/lib/geo";
import { BUSINESS_CATEGORIES } from "@/lib/utils-social";
import { Loader2, Camera, ArrowLeft, Save, Trash2, MapPin, Phone, Building2, Navigation } from "lucide-react";
import { toast } from "sonner";

export default function EditProfile() {
  const { user, refresh, updateLocation } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const shopFileRef = useRef(null);
  const [form, setForm] = useState({
    name: "", area: "", bio: "", avatar_path: null,
    phone: "", business_name: "", business_category: "food",
    shop_image_path: null,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const isBiz = user?.account_type === "business";

  useEffect(() => {
    if (user && typeof user === "object") {
      setForm({
        name: user.name || "",
        area: user.area || "",
        bio: user.bio || "",
        avatar_path: user.avatar_path || null,
        phone: user.phone || "",
        business_name: user.business_name || "",
        business_category: user.business_category || "food",
        shop_image_path: user.shop_image_path || null,
      });
    }
  }, [user]);

  const doUpload = async (file, setPath) => {
    if (!file.type.startsWith("image/")) return toast.error("Choose an image");
    if (file.size > 4 * 1024 * 1024) return toast.error("Image too large (max 4MB)");
    setUploading(true);
    try {
      const res = await uploadImage(file);
      setPath(res.path);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Upload failed");
    } finally { setUploading(false); }
  };

  const onPickAvatar = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (f) await doUpload(f, (p) => setForm((f0) => ({ ...f0, avatar_path: p })));
  };
  const onPickShop = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (f) await doUpload(f, (p) => setForm((f0) => ({ ...f0, shop_image_path: p })));
  };

  const refreshLocation = async () => {
    setLocBusy(true);
    try {
      const loc = await getBrowserLocation();
      await updateLocation(loc.lat, loc.lng);
      toast.success("Location updated");
    } catch {
      toast.error("Couldn't get your location");
    } finally { setLocBusy(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name, area: form.area, bio: form.bio,
        avatar_path: form.avatar_path, phone: form.phone,
      };
      if (isBiz) {
        payload.business_name = form.business_name;
        payload.business_category = form.business_category;
        payload.shop_image_path = form.shop_image_path;
      }
      await api.patch("/users/me", payload);
      await refresh?.();
      toast.success("Profile updated");
      navigate(isBiz ? `/shop/${user.id}` : "/profile");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not save");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-28">
      <div className="max-w-2xl mx-auto">
        <TopBar />

        <div className="px-4 sm:px-6 mt-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} data-testid="edit-back-btn" className="w-9 h-9 border-2 border-[#111111] brut-press bg-white flex items-center justify-center">
            <ArrowLeft size={16} strokeWidth={2.75} />
          </button>
          <h1 className="font-heading font-black text-2xl tracking-tighter">Edit {isBiz ? "shop" : "profile"}</h1>
        </div>

        <form onSubmit={save} data-testid="edit-profile-form" className="px-4 sm:px-6 mt-6">
          <div className="bg-white border-2 border-[#111111] brut-shadow p-5">
            {/* Avatar */}
            <div className="flex items-center gap-4 pb-4 border-b-2 border-dashed border-[#111111]/30">
              <div className="relative">
                <Avatar name={form.name} path={form.avatar_path} size={84} />
                <button type="button" onClick={() => fileRef.current?.click()} data-testid="avatar-upload-btn" disabled={uploading} className="absolute -bottom-1 -right-1 w-9 h-9 bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow-sm flex items-center justify-center rounded-full">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} strokeWidth={2.75} />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-[#8A8A8A]">Profile photo</div>
                <p className="text-[12px] text-[#8A8A8A] font-semibold mt-1">Square. Max 4MB.</p>
              </div>
            </div>

            <label className="block mt-4">
              <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Your name</span>
              <input data-testid="edit-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none" />
            </label>

            <label className="block mt-3">
              <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Area</span>
              <input data-testid="edit-area-input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none" />
            </label>

            <label className="block mt-3">
              <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Bio</span>
              <textarea data-testid="edit-bio-input" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 180) })} placeholder={isBiz ? "Tell customers about your shop" : "A line about you"} rows={3} className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none resize-none" />
              <div className="text-right text-[10px] font-bold text-[#8A8A8A] mt-0.5">{180 - form.bio.length}</div>
            </label>

            <label className="block mt-3">
              <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block flex items-center gap-1"><Phone size={10} /> Phone</span>
              <input data-testid="edit-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98100 00000" className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none" />
            </label>

            {isBiz && (
              <div className="mt-4 pt-4 border-t-2 border-dashed border-[#111111]/30">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-[#8A8A8A] mb-2 flex items-center gap-1">
                  <Building2 size={12} /> Business details
                </div>
                <label className="block">
                  <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Business name</span>
                  <input data-testid="edit-biz-name-input" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none" />
                </label>
                <label className="block mt-3">
                  <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Category</span>
                  <select data-testid="edit-biz-cat" value={form.business_category} onChange={(e) => setForm({ ...form, business_category: e.target.value })} className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none">
                    {BUSINESS_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                  </select>
                </label>
                <div className="mt-3">
                  <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Shop banner</span>
                  <div className="flex items-center gap-3">
                    <Avatar name={form.business_name} path={form.shop_image_path} size={64} />
                    <button type="button" onClick={() => shopFileRef.current?.click()} disabled={uploading} className="border-2 border-[#111111] px-3 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press bg-[#C4A1FF]">
                      {form.shop_image_path ? "Replace" : "Upload banner"}
                    </button>
                    <input ref={shopFileRef} type="file" accept="image/*" onChange={onPickShop} className="hidden" />
                  </div>
                </div>
              </div>
            )}

            {/* Location */}
            <div className="mt-4 pt-4 border-t-2 border-dashed border-[#111111]/30">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-[#8A8A8A] mb-2 flex items-center gap-1">
                <MapPin size={12} /> Location (for 5 km radius)
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold">
                  {user?.lat != null ? (
                    <span className="text-[#111111]">📍 Set · {user.lat.toFixed(3)}, {user.lng.toFixed(3)}</span>
                  ) : (
                    <span className="text-[#8A8A8A]">Not set yet</span>
                  )}
                </div>
                <button type="button" onClick={refreshLocation} disabled={locBusy} data-testid="refresh-location-btn" className="border-2 border-[#111111] px-3 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press bg-[#FFE973] flex items-center gap-1.5">
                  {locBusy ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} strokeWidth={3} />}
                  {user?.lat != null ? "Update" : "Use my location"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={saving} data-testid="edit-save-btn" className="bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={3} />}
              Save changes
            </button>
          </div>
        </form>
      </div>

      <BottomNav onCreate={() => navigate("/feed")} />
    </div>
  );
}
