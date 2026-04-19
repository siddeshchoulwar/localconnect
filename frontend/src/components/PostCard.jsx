import React, { useState } from "react";
import { Heart, MapPin, Tag } from "lucide-react";
import { api } from "@/lib/api";

function timeAgo(iso) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Deterministic color from name
const AVATAR_COLORS = ["#FF5E5E", "#C4A1FF", "#FFE973", "#7DE2A1", "#8DD3FE", "#FFB572"];
function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function PostCard({ post, onLikeToggled }) {
  const isOffer = post.type === "offer";
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [popping, setPopping] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLike = async () => {
    if (busy) return;
    setBusy(true);
    // optimistic
    const prevLiked = liked;
    const prevLikes = likes;
    setLiked(!prevLiked);
    setLikes(prevLiked ? prevLikes - 1 : prevLikes + 1);
    setPopping(true);
    setTimeout(() => setPopping(false), 340);
    try {
      const { data } = await api.post(`/posts/${post.id}/like`);
      setLiked(data.liked);
      setLikes(data.likes);
      onLikeToggled?.(post.id, data);
    } catch (e) {
      // revert
      setLiked(prevLiked);
      setLikes(prevLikes);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      data-testid={`post-card-${post.id}`}
      className={`relative border-2 border-[#111111] brut-shadow p-5 mb-6 enter-up ${
        isOffer ? "bg-[#FFE973]" : "bg-white"
      }`}
    >
      {isOffer && (
        <span
          data-testid={`post-offer-tag-${post.id}`}
          className="absolute -top-3 -left-1 bg-[#FF5E5E] text-white text-[10px] font-black px-3 py-1 border-2 border-[#111111] uppercase tracking-[0.25em] brut-shadow-sm flex items-center gap-1"
        >
          <Tag size={12} strokeWidth={3} /> OFFER
        </span>
      )}

      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 border-2 border-[#111111] flex items-center justify-center font-heading font-black text-sm"
          style={{ background: colorFor(post.user_name) }}
          data-testid={`post-avatar-${post.id}`}
        >
          {initials(post.user_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-black text-base leading-tight truncate">
            {post.user_name}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[#8A8A8A] font-semibold uppercase tracking-wider">
            <MapPin size={11} strokeWidth={2.75} />
            <span className="truncate">{post.area}</span>
            <span>·</span>
            <span>{timeAgo(post.timestamp)}</span>
          </div>
        </div>
      </div>

      <p
        className="text-[15px] leading-snug font-medium text-[#111111] whitespace-pre-wrap break-words"
        data-testid={`post-content-${post.id}`}
      >
        {post.content}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={handleLike}
          data-testid={`post-like-btn-${post.id}`}
          disabled={busy}
          className={`flex items-center gap-2 border-2 border-[#111111] px-3 py-1.5 brut-press font-heading font-black text-sm ${
            liked ? "bg-[#FF5E5E] text-white" : "bg-white text-[#111111]"
          }`}
        >
          <Heart
            size={16}
            strokeWidth={2.75}
            fill={liked ? "currentColor" : "none"}
            className={popping ? "heart-pop" : ""}
          />
          <span data-testid={`post-like-count-${post.id}`}>{likes}</span>
        </button>

        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8A8A8A]">
          #{isOffer ? "offer" : "neighbourhood"}
        </div>
      </div>
    </article>
  );
}
