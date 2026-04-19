import React, { useRef, useState } from "react";
import { X, Image as ImageIcon, Megaphone, Sparkles, Send, Loader2, Trash2 } from "lucide-react";
import { api, mediaUrl, uploadImage, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/Avatar";

export default function CreatePostDialog({ open, onClose, onCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [type, setType] = useState("normal");
  const [imagePaths, setImagePaths] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);
  const max = 500;

  const reset = () => {
    setContent(""); setType("normal"); setImagePaths([]);
    setSubmitting(false); setUploading(false);
  };
  const handleClose = () => { if (!submitting && !uploading) { reset(); onClose?.(); } };

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (imagePaths.length + files.length > 6) {
      toast.error("Max 6 images per post");
      return;
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 6 * 1024 * 1024) { toast.error(`"${file.name}" > 6MB, skipped`); continue; }
        const res = await uploadImage(file);
        uploaded.push(res.path);
      }
      setImagePaths((prev) => [...prev, ...uploaded]);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if ((!content.trim() && !imagePaths.length) || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/posts", { content: content.trim(), type, image_paths: imagePaths });
      onCreated?.(data);
      toast.success(type === "offer" ? "Offer posted!" : "Shared with your area!");
      reset(); onClose?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not post");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div data-testid="create-post-dialog" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#111111]/50" onClick={handleClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#FFFDF5] border-2 border-[#111111] brut-shadow w-full sm:max-w-lg max-h-[92vh] overflow-hidden flex flex-col enter-up">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#111111] bg-white">
          <div className="font-heading font-black text-lg tracking-tighter">New post</div>
          <button onClick={handleClose} data-testid="create-close-btn" className="w-8 h-8 border-2 border-[#111111] brut-press bg-white flex items-center justify-center">
            <X size={14} strokeWidth={3} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <Avatar name={user?.name} path={user?.avatar_path} size={36} />
            <div>
              <div className="font-heading font-black text-sm leading-tight">{user?.name}</div>
              <div className="text-[11px] font-bold text-[#8A8A8A]">Posting to {user?.area} · Use @name to mention</div>
            </div>
          </div>

          <textarea data-testid="create-post-input" value={content} onChange={(e) => setContent(e.target.value.slice(0, max))} placeholder="Share news, a recommendation, or @mention a neighbour…" rows={4} className="w-full border-2 border-[#111111] bg-white p-3 font-medium text-[15px] focus:outline-none resize-none" />

          {imagePaths.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {imagePaths.map((p, i) => (
                <div key={p} className="relative border-2 border-[#111111] bg-[#111111] aspect-square">
                  <img src={mediaUrl(p)} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setImagePaths((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-6 h-6 bg-white border-2 border-[#111111] flex items-center justify-center">
                    <Trash2 size={11} strokeWidth={2.75} className="text-[#FF5E5E]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setType("normal")} data-testid="create-type-normal" className={`flex items-center gap-1.5 border-2 border-[#111111] px-2.5 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press ${type === "normal" ? "bg-[#111111] text-[#FFE973]" : "bg-white"}`}>
                <Sparkles size={12} strokeWidth={3} /> Normal
              </button>
              <button onClick={() => setType("offer")} data-testid="create-type-offer" className={`flex items-center gap-1.5 border-2 border-[#111111] px-2.5 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press ${type === "offer" ? "bg-[#FFE973]" : "bg-white"}`}>
                <Megaphone size={12} strokeWidth={3} /> Offer
              </button>
              <button onClick={() => fileRef.current?.click()} data-testid="create-upload-btn" disabled={uploading || imagePaths.length >= 6} className="flex items-center gap-1.5 border-2 border-[#111111] px-2.5 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press bg-[#C4A1FF] disabled:opacity-50">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} strokeWidth={3} />}
                {uploading ? "Uploading" : `Add image${imagePaths.length > 0 ? ` (${imagePaths.length}/6)` : ""}`}
              </button>
              <input ref={fileRef} onChange={onPickFiles} type="file" accept="image/*" multiple className="hidden" />
            </div>
            <span className={`text-xs font-bold ${max - content.length < 30 ? "text-[#FF5E5E]" : "text-[#8A8A8A]"}`}>
              {max - content.length}
            </span>
          </div>
        </div>

        <div className="p-4 border-t-2 border-[#111111] bg-white flex justify-end">
          <button onClick={submit} data-testid="create-submit-btn" disabled={submitting || (!content.trim() && !imagePaths.length)} className="bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={3} />}
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
