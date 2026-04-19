import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import Avatar from "@/components/Avatar";
import { api, mediaUrl, uploadImage, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Camera, ArrowLeft, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function EditProfile() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ name: "", area: "", bio: "", avatar_path: null });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && typeof user === "object") {
      setForm({
        name: user.name || "",
        area: user.area || "",
        bio: user.bio || "",
        avatar_path: user.avatar_path || null,
      });
    }
  }, [user]);

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image");
    if (file.size > 4 * 1024 * 1024) return toast.error("Image too large (max 4MB)");
    setUploading(true);
    try {
      const res = await uploadImage(file);
      setForm((f) => ({ ...f, avatar_path: res.path }));
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api.patch("/users/me", form);
      await refresh?.();
      toast.success("Profile updated");
      navigate("/profile");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-28">
      <div className="max-w-2xl mx-auto">
        <TopBar />

        <div className="px-4 sm:px-6 mt-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            data-testid="edit-back-btn"
            className="w-9 h-9 border-2 border-[#111111] brut-press bg-white flex items-center justify-center"
          >
            <ArrowLeft size={16} strokeWidth={2.75} />
          </button>
          <h1 className="font-heading font-black text-2xl tracking-tighter">Edit profile</h1>
        </div>

        <form onSubmit={save} data-testid="edit-profile-form" className="px-4 sm:px-6 mt-6">
          <div className="bg-white border-2 border-[#111111] brut-shadow p-5">
            <div className="flex items-center gap-4 pb-4 border-b-2 border-dashed border-[#111111]/30">
              <div className="relative">
                <Avatar name={form.name} path={form.avatar_path} size={88} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  data-testid="avatar-upload-btn"
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-9 h-9 bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow-sm flex items-center justify-center rounded-full"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} strokeWidth={2.75} />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-[#8A8A8A]">Profile photo</div>
                <p className="text-[12px] text-[#8A8A8A] font-semibold mt-1">Square images work best. Max 4MB.</p>
                {form.avatar_path && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, avatar_path: null }))}
                    data-testid="avatar-remove-btn"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5E5E] hover:underline"
                  >
                    <Trash2 size={11} strokeWidth={2.75} /> Remove
                  </button>
                )}
              </div>
            </div>

            <label className="block mt-4">
              <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Display name</span>
              <input
                data-testid="edit-name-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={60}
                className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none focus:bg-[#FFFDF5]"
              />
            </label>

            <label className="block mt-3">
              <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Area / neighbourhood</span>
              <input
                data-testid="edit-area-input"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                maxLength={60}
                className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none focus:bg-[#FFFDF5]"
              />
              <span className="text-[10px] font-bold text-[#8A8A8A] mt-1 block">
                Changing area will switch your feed to the new neighbourhood.
              </span>
            </label>

            <label className="block mt-3">
              <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Bio</span>
              <textarea
                data-testid="edit-bio-input"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 180) })}
                placeholder="Tell your neighbours a bit about you"
                rows={3}
                className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none focus:bg-[#FFFDF5] resize-none"
              />
              <div className="text-right text-[10px] font-bold text-[#8A8A8A] mt-0.5">{180 - form.bio.length}</div>
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              data-testid="edit-save-btn"
              className="bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={3} />}
              Save changes
            </button>
          </div>
        </form>
      </div>

      <BottomNav onCreate={() => {}} />
    </div>
  );
}
