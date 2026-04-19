import React, { useEffect, useRef, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/utils-social";
import { Link } from "react-router-dom";

export default function CommentsSheet({ post, open, onClose, onCountChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open || !post) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/posts/${post.id}/comments`);
        if (!cancel) setComments(data);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, post?.id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/posts/${post.id}/comments`, { content: text.trim() });
      setComments((prev) => [...prev, data]);
      onCountChange?.(post.id, comments.length + 1);
      setText("");
      // scroll to bottom
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    } finally {
      setSending(false);
    }
  };

  if (!open || !post) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[#111111]/50"
      onClick={onClose}
      data-testid="comments-sheet"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FFFDF5] border-2 border-[#111111] brut-shadow w-full sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden enter-up"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#111111] bg-white">
          <div className="font-heading font-black text-lg">Comments</div>
          <button
            onClick={onClose}
            data-testid="comments-close-btn"
            className="w-8 h-8 border-2 border-[#111111] brut-press bg-white flex items-center justify-center"
          >
            <X size={14} strokeWidth={3} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[40vh]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10">
              <div className="font-heading font-black text-xl mb-1">No comments yet</div>
              <p className="text-sm text-[#8A8A8A] font-medium">Be the first to chime in.</p>
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3" data-testid={`comment-${c.id}`}>
                <Link to={`/profile/${c.user_id}`}>
                  <Avatar name={c.user_name} path={c.user_avatar_path} size={34} />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="bg-white border-2 border-[#111111] p-2.5">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <Link to={`/profile/${c.user_id}`} className="font-heading font-black text-[13px] truncate">
                        {c.user_name}
                      </Link>
                      <span className="text-[10px] font-bold text-[#8A8A8A]">{timeAgo(c.timestamp)}</span>
                    </div>
                    <div className="text-[14px] font-medium break-words whitespace-pre-wrap">{c.content}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={submit} className="p-3 border-t-2 border-[#111111] bg-white flex items-center gap-2">
          <Avatar name={user?.name} path={user?.avatar_path} size={34} />
          <input
            data-testid="comment-input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            placeholder={`Reply as ${user?.name?.split(" ")[0] || "you"}…`}
            className="flex-1 border-2 border-[#111111] bg-white px-3 py-2 text-sm font-medium focus:outline-none"
          />
          <button
            type="submit"
            data-testid="comment-submit-btn"
            disabled={!text.trim() || sending}
            className="bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow-sm brut-press font-heading font-black text-xs uppercase tracking-wider px-3 py-2 flex items-center gap-1 disabled:opacity-50"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} strokeWidth={3} />}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
