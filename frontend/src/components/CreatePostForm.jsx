import React, { useState } from "react";
import { Megaphone, Sparkles, Send, Loader2 } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";

export default function CreatePostForm({ onCreated }) {
  const [content, setContent] = useState("");
  const [type, setType] = useState("normal");
  const [submitting, setSubmitting] = useState(false);

  const max = 280;
  const remaining = max - content.length;

  const submit = async (e) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/posts", { content: content.trim(), type });
      setContent("");
      setType("normal");
      onCreated?.(data);
      toast.success(type === "offer" ? "Offer posted to your area!" : "Post shared with your area!");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not post");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      data-testid="create-post-form"
      className="bg-white border-2 border-[#111111] brut-shadow p-4 mb-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-[#C4A1FF] border-2 border-[#111111] flex items-center justify-center">
          <Sparkles size={16} strokeWidth={2.75} />
        </div>
        <div className="font-heading font-black text-base leading-tight">What's up in your area?</div>
      </div>

      <textarea
        data-testid="create-post-input"
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, max))}
        placeholder="Share news, a recommendation, or a sweet offer…"
        rows={3}
        className="w-full border-2 border-[#111111] p-3 font-medium placeholder-[#8A8A8A] focus:outline-none focus:bg-[#FFFDF5] resize-none text-[15px]"
      />

      <div className="flex items-center justify-between mt-3 gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("normal")}
            data-testid="post-type-normal-btn"
            className={`flex items-center gap-1.5 border-2 border-[#111111] px-3 py-1.5 font-heading font-black text-xs uppercase tracking-wider brut-press ${
              type === "normal" ? "bg-[#111111] text-[#FFE973]" : "bg-white text-[#111111]"
            }`}
          >
            <Sparkles size={13} strokeWidth={3} /> Normal
          </button>
          <button
            type="button"
            onClick={() => setType("offer")}
            data-testid="post-type-offer-btn"
            className={`flex items-center gap-1.5 border-2 border-[#111111] px-3 py-1.5 font-heading font-black text-xs uppercase tracking-wider brut-press ${
              type === "offer" ? "bg-[#FFE973] text-[#111111]" : "bg-white text-[#111111]"
            }`}
          >
            <Megaphone size={13} strokeWidth={3} /> Offer
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold ${remaining < 30 ? "text-[#FF5E5E]" : "text-[#8A8A8A]"}`}>
            {remaining}
          </span>
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            data-testid="create-post-submit-btn"
            className="flex items-center gap-1.5 bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow-sm brut-press font-heading font-black text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 size={14} strokeWidth={3} className="animate-spin" />
            ) : (
              <Send size={14} strokeWidth={3} />
            )}
            Post
          </button>
        </div>
      </div>
    </form>
  );
}
