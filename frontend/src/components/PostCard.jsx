import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, MapPin, Tag, Trash2, ChevronLeft, ChevronRight, BadgeCheck } from "lucide-react";
import { api, mediaUrl } from "@/lib/api";
import Avatar from "@/components/Avatar";
import { timeAgo, shortCount, renderWithMentions } from "@/lib/utils-social";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function PostCard({ post, onLikeToggled, onCommentsClick, onDeleted }) {
  const { user } = useAuth();
  const isOffer = post.type === "offer";
  const isMine = user && typeof user === "object" && user.id === post.user_id;
  const isBizAuthor = post.user_account_type === "business";

  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [saved, setSaved] = useState(post.saved);
  const [popping, setPopping] = useState(false);
  const [showDouble, setShowDouble] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);

  const images = post.image_paths || [];

  const handleLike = async (fromDoubleTap = false) => {
    if (busy) return;
    if (fromDoubleTap && liked) {
      setShowDouble(true);
      setTimeout(() => setShowDouble(false), 700);
      return;
    }
    setBusy(true);
    const prevLiked = liked;
    const prevLikes = likes;
    setLiked(!prevLiked);
    setLikes(prevLiked ? prevLikes - 1 : prevLikes + 1);
    setPopping(true);
    setTimeout(() => setPopping(false), 340);
    if (fromDoubleTap) { setShowDouble(true); setTimeout(() => setShowDouble(false), 700); }
    try {
      const { data } = await api.post(`/posts/${post.id}/like`);
      setLiked(data.liked); setLikes(data.likes);
      onLikeToggled?.(post.id, data);
    } catch {
      setLiked(prevLiked); setLikes(prevLikes);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const prev = saved;
    setSaved(!prev);
    try {
      const { data } = await api.post(`/posts/${post.id}/save`);
      setSaved(data.saved);
      toast.success(data.saved ? "Saved to bookmarks" : "Removed from bookmarks");
    } catch { setSaved(prev); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await api.delete(`/posts/${post.id}`);
      onDeleted?.(post.id);
      toast.success("Post deleted");
    } catch { toast.error("Could not delete"); }
  };

  const lastTap = useRef(0);
  const onImageTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) { handleLike(true); lastTap.current = 0; }
    else lastTap.current = now;
  };

  return (
    <article data-testid={`post-card-${post.id}`} className={`relative border-2 border-[#111111] brut-shadow mb-6 enter-up overflow-hidden ${isOffer ? "bg-[#FFE973]" : "bg-white"}`}>
      <div className="flex items-center gap-3 p-3">
        <Link to={isBizAuthor ? `/shop/${post.user_id}` : `/profile/${post.user_id}`}>
          <Avatar name={post.user_name} path={post.user_avatar_path} size={40} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={isBizAuthor ? `/shop/${post.user_id}` : `/profile/${post.user_id}`} className="font-heading font-black text-sm leading-tight truncate flex items-center gap-1 hover:underline">
            {post.user_name}
            {isBizAuthor && <BadgeCheck size={14} strokeWidth={3} className="text-[#FF5E5E] shrink-0" />}
          </Link>
          <div className="flex items-center gap-1 text-[11px] text-[#111111]/60 font-semibold">
            <MapPin size={10} strokeWidth={2.75} />
            <span className="truncate">{post.area}</span>
            <span>·</span>
            <span>{timeAgo(post.timestamp)}</span>
          </div>
        </div>
        {isOffer && (
          <span className="bg-[#FF5E5E] text-white text-[10px] font-black px-2 py-1 border-2 border-[#111111] uppercase tracking-[0.2em] flex items-center gap-1 shrink-0">
            <Tag size={11} strokeWidth={3} /> Offer
          </span>
        )}
        {isMine && (
          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen((o) => !o)} data-testid={`post-menu-btn-${post.id}`} className="w-8 h-8 border-2 border-[#111111] bg-white brut-press flex items-center justify-center">
              <MoreHorizontal size={14} strokeWidth={2.75} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 bg-white border-2 border-[#111111] brut-shadow z-10 w-40">
                <button onClick={() => { setMenuOpen(false); handleDelete(); }} data-testid={`post-delete-btn-${post.id}`} className="w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 hover:bg-[#FFFDF5]">
                  <Trash2 size={13} strokeWidth={2.75} className="text-[#FF5E5E]" /> Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="relative bg-[#111111] border-y-2 border-[#111111] select-none" onClick={onImageTap} data-testid={`post-image-wrap-${post.id}`}>
          <img src={mediaUrl(images[idx])} alt="" className="w-full max-h-[560px] object-cover block" draggable={false} />
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)); }} disabled={idx === 0} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 border-2 border-[#111111] flex items-center justify-center disabled:opacity-30">
                <ChevronLeft size={14} strokeWidth={3} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.min(images.length - 1, i + 1)); }} disabled={idx === images.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 border-2 border-[#111111] flex items-center justify-center disabled:opacity-30">
                <ChevronRight size={14} strokeWidth={3} />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-[#111111]/80 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {idx + 1} / {images.length}
              </div>
            </>
          )}
          {showDouble && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Heart size={92} strokeWidth={1.5} fill="#FF5E5E" className="text-white heart-pop drop-shadow-[4px_4px_0_#111111]" />
            </div>
          )}
        </div>
      )}

      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <button onClick={() => handleLike(false)} data-testid={`post-like-btn-${post.id}`} disabled={busy} className="w-10 h-10 border-2 border-[#111111] brut-press bg-white flex items-center justify-center" style={{ background: liked ? "#FF5E5E" : "#ffffff" }} aria-label="Like">
          <Heart size={18} strokeWidth={2.75} fill={liked ? "currentColor" : "none"} className={`${liked ? "text-white" : "text-[#111111]"} ${popping ? "heart-pop" : ""}`} />
        </button>
        <button onClick={() => onCommentsClick?.(post)} data-testid={`post-comments-btn-${post.id}`} className="w-10 h-10 border-2 border-[#111111] brut-press bg-white flex items-center justify-center" aria-label="Comments">
          <MessageCircle size={18} strokeWidth={2.75} />
        </button>
        <div className="flex-1" />
        <button onClick={handleSave} data-testid={`post-save-btn-${post.id}`} className="w-10 h-10 border-2 border-[#111111] brut-press flex items-center justify-center" style={{ background: saved ? "#111111" : "#ffffff" }} aria-label="Save">
          <Bookmark size={18} strokeWidth={2.75} fill={saved ? "currentColor" : "none"} className={saved ? "text-[#FFE973]" : "text-[#111111]"} />
        </button>
      </div>

      <div className="px-3">
        <div className="font-heading font-black text-sm" data-testid={`post-like-count-${post.id}`}>
          {shortCount(likes)} like{likes === 1 ? "" : "s"}
        </div>
      </div>

      {post.content && (
        <p data-testid={`post-content-${post.id}`} className="px-3 pt-1.5 pb-2 text-[14.5px] leading-snug font-medium whitespace-pre-wrap break-words">
          <Link to={isBizAuthor ? `/shop/${post.user_id}` : `/profile/${post.user_id}`} className="font-heading font-black mr-1.5">
            {post.user_name}
          </Link>
          {renderWithMentions(post.content)}
        </p>
      )}

      {post.comments_count > 0 ? (
        <button onClick={() => onCommentsClick?.(post)} className="px-3 pb-3 text-xs font-bold text-[#111111]/60 hover:text-[#111111]" data-testid={`post-view-comments-${post.id}`}>
          View all {post.comments_count} comment{post.comments_count === 1 ? "" : "s"}
        </button>
      ) : (
        <div className="px-3 pb-3 text-xs font-bold text-[#111111]/50">Be the first to comment</div>
      )}
    </article>
  );
}
