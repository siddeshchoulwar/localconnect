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
  const [imagePath, setImagePath] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);
  const max = 500;

  const reset = () => {
    setContent("");
    setType("normal");
    setImagePath(null);
    setSubmitting(false);
    setUploading(false);
  };

  const handleClose = () => {
    if (submitting || uploading) return;
    reset();
    onClose?.();
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Image too large (max 6MB)");
      return;
    }
    setUploading(true);
    try {
      const res = await uploadImage(file);
      setImagePath(res.path);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if ((!content.trim() && !imagePath) || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/posts", {
        content: content.trim(),
        type,
        image_path: imagePath,
      });
      onCreated?.(data);
      toast.success(type === "offer" ? "Offer posted to your area!" : "Shared with your area!");
      reset();
      onClose?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not post");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const imgUrl = mediaUrl(imagePath);

  return (
    <div
      data-testid="create-post-dialog"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#111111]/50"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FFFDF5] border-2 border-[#111111] brut-shadow w-full sm:max-w-lg max-h-[92vh] overflow-hidden flex flex-col enter-up"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#111111] bg-white">
          <div className="font-heading font-black text-lg tracking-tighter">New post</div>
          <button
            onClick={handleClose}
            data-testid="create-close-btn"
            className="w-8 h-8 border-2 border-[#111111] brut-press bg-white flex items-center justify-center"
          >
            <X size={14} strokeWidth={3} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <Avatar name={user?.name} path={user?.avatar_path} size={36} />
            <div>
              <div className="font-heading font-black text-sm leading-tight">{user?.name}</div>
              <div className="text-[11px] font-bold text-[#8A8A8A]">Posting to {user?.area}</div>
            </div>
          </div>

          <textarea
            data-testid="create-post-input"
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, max))}
            placeholder="Share news, a recommendation, or a sweet offer…"
            rows={4}
            className="w-full border-2 border-[#111111] bg-white p-3 font-medium text-[15px] focus:outline-none focus:bg-white resize-none"
          />

          {imgUrl && (
            <div className="mt-3 relative border-2 border-[#111111] bg-[#111111]">
              <img src={imgUrl} alt="" className="w-full max-h-[360px] object-cover block" />
              <button
                onClick={() => setImagePath(null)}
                data-testid="create-remove-image-btn"
                className="absolute top-2 right-2 w-8 h-8 border-2 border-[#111111] bg-white brut-shadow-sm flex items-center justify-center"
              >
                <Trash2 size={14} strokeWidth={2.75} className="text-[#FF5E5E]" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={() => setType("normal")}
                data-testid="create-type-normal"
                className={`flex items-center gap-1.5 border-2 border-[#111111] px-2.5 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press ${
                  type === "normal" ? "bg-[#111111] text-[#FFE973]" : "bg-white"
                }`}
              >
                <Sparkles size={12} strokeWidth={3} /> Normal
              </button>
              <button
                onClick={() => setType("offer")}
                data-testid="create-type-offer"
                className={`flex items-center gap-1.5 border-2 border-[#111111] px-2.5 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press ${
                  type === "offer" ? "bg-[#FFE973] text-[#111111]" : "bg-white"
                }`}
              >
                <Megaphone size={12} strokeWidth={3} /> Offer
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                data-testid="create-upload-btn"
                disabled={uploading}
                className="flex items-center gap-1.5 border-2 border-[#111111] px-2.5 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press bg-[#C4A1FF]"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} strokeWidth={3} />}
                {uploading ? "Uploading" : imagePath ? "Replace" : "Image"}
              </button>
              <input ref={fileRef} onChange={onPickFile} type="file" accept="image/*" className="hidden" data-testid="create-file-input" />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className={`text-xs font-bold ${max - content.length < 30 ? "text-[#FF5E5E]" : "text-[#8A8A8A]"}`}>
                {max - content.length}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t-2 border-[#111111] bg-white flex justify-end">
          <button
            onClick={submit}
            data-testid="create-submit-btn"
            disabled={submitting || (!content.trim() && !imagePath)}
            className="bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={3} />}
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
