import React, { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import PostCard from "@/components/PostCard";
import CreatePostForm from "@/components/CreatePostForm";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2, MapPin, Users, Inbox } from "lucide-react";

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/posts");
      setPosts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onCreated = (post) => {
    setPosts((prev) => [post, ...prev]);
  };

  const offerCount = posts.filter((p) => p.type === "offer").length;

  return (
    <div className="min-h-screen bg-[#FFFDF5]">
      <div className="w-full max-w-lg mx-auto sm:border-x-2 border-[#111111] min-h-screen">
        <Header />

        <main className="p-4 sm:p-6">
          {/* Area banner */}
          <div
            data-testid="area-banner"
            className="bg-[#C4A1FF] border-2 border-[#111111] brut-shadow p-4 mb-6 relative overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 relative z-10">
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
                <div className="bg-[#111111] text-[#FFE973] px-2 py-1 border-2 border-[#111111] text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Users size={11} strokeWidth={3} /> {posts.length} posts
                </div>
                {offerCount > 0 && (
                  <div className="bg-[#FFE973] text-[#111111] px-2 py-1 border-2 border-[#111111] text-[10px] font-black uppercase tracking-wider">
                    {offerCount} offer{offerCount > 1 ? "s" : ""} live
                  </div>
                )}
              </div>
            </div>
          </div>

          <CreatePostForm onCreated={onCreated} />

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} />
            </div>
          ) : posts.length === 0 ? (
            <div
              data-testid="feed-empty"
              className="bg-white border-2 border-[#111111] brut-shadow p-8 text-center"
            >
              <Inbox size={40} strokeWidth={2} className="mx-auto mb-3 text-[#8A8A8A]" />
              <div className="font-heading font-black text-xl mb-1">Quiet on this block</div>
              <p className="text-sm text-[#8A8A8A] font-medium">
                Be the first to share something with neighbours in <b>{user?.area}</b>.
              </p>
            </div>
          ) : (
            <div data-testid="feed-list">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}

          <div className="text-center py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8A8A]">
            ★ you've reached the edge of the block ★
          </div>
        </main>
      </div>
    </div>
  );
}
