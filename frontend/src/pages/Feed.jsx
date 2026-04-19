import React, { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import PostCard from "@/components/PostCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import CommentsSheet from "@/components/CommentsSheet";
import StoriesBar from "@/components/StoriesBar";
import LocationPrompt from "@/components/LocationPrompt";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2, MapPin, Sparkles, Inbox, Megaphone } from "lucide-react";

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/posts");
      setPosts(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCreated = (post) => setPosts((prev) => [post, ...prev]);
  const onDeleted = (id) => setPosts((prev) => prev.filter((p) => p.id !== id));
  const onCommentsCountChange = (postId, count) =>
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments_count: count } : p)));

  const filtered = filter === "offers" ? posts.filter((p) => p.type === "offer") : posts;
  const offerCount = posts.filter((p) => p.type === "offer").length;

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-28">
      <div className="max-w-2xl mx-auto">
        <TopBar />
        <LocationPrompt />

        <div className="px-4 sm:px-6 mt-4">
          <div data-testid="area-banner" className="bg-[#C4A1FF] border-2 border-[#111111] brut-shadow p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin size={14} strokeWidth={3} />
                  <span className="uppercase text-[10px] font-black tracking-[0.3em]">Your area</span>
                </div>
                <div className="font-heading font-black text-2xl sm:text-3xl tracking-tighter leading-none">
                  {user?.area}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="bg-[#111111] text-[#FFE973] px-2 py-1 border-2 border-[#111111] text-[10px] font-black uppercase tracking-wider">
                  {posts.length} posts
                </div>
                {offerCount > 0 && (
                  <div className="bg-[#FFE973] px-2 py-1 border-2 border-[#111111] text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Megaphone size={10} strokeWidth={3} /> {offerCount} offer{offerCount > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <StoriesBar onCreate={() => setCreateOpen(true)} />

        <div className="px-4 sm:px-6 mt-4 flex gap-2">
          <button onClick={() => setFilter("all")} data-testid="filter-all-btn" className={`flex items-center gap-1.5 border-2 border-[#111111] px-3 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press ${filter === "all" ? "bg-[#111111] text-[#FFE973]" : "bg-white"}`}>
            <Sparkles size={12} strokeWidth={3} /> All
          </button>
          <button onClick={() => setFilter("offers")} data-testid="filter-offers-btn" className={`flex items-center gap-1.5 border-2 border-[#111111] px-3 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press ${filter === "offers" ? "bg-[#FFE973]" : "bg-white"}`}>
            <Megaphone size={12} strokeWidth={3} /> Offers only
          </button>
        </div>

        <main className="px-4 sm:px-6 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} />
            </div>
          ) : filtered.length === 0 ? (
            <div data-testid="feed-empty" className="bg-white border-2 border-[#111111] brut-shadow p-8 text-center">
              <Inbox size={40} strokeWidth={2} className="mx-auto mb-3 text-[#8A8A8A]" />
              <div className="font-heading font-black text-xl mb-1">
                {filter === "offers" ? "No offers yet" : "Quiet on this block"}
              </div>
              <p className="text-sm text-[#8A8A8A] font-medium">
                {filter === "offers" ? "No offers live in your area." : <>Be the first to share something with <b>{user?.area}</b>.</>}
              </p>
            </div>
          ) : (
            <div data-testid="feed-list">
              {filtered.map((p) => (
                <PostCard key={p.id} post={p} onCommentsClick={(post) => setCommentsFor(post)} onDeleted={onDeleted} />
              ))}
            </div>
          )}

          <div className="text-center py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8A8A]">
            ★ you've reached the edge of the block ★
          </div>
        </main>
      </div>

      <BottomNav onCreate={() => setCreateOpen(true)} />
      <CreatePostDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onCreated} />
      <CommentsSheet post={commentsFor} open={!!commentsFor} onClose={() => setCommentsFor(null)} onCountChange={onCommentsCountChange} />
    </div>
  );
}
