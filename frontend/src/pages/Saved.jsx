import React, { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import PostCard from "@/components/PostCard";
import CommentsSheet from "@/components/CommentsSheet";
import CreatePostDialog from "@/components/CreatePostDialog";
import { api } from "@/lib/api";
import { Loader2, Bookmark } from "lucide-react";

export default function Saved() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/me/saved");
      setPosts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-20">
      <div className="max-w-2xl mx-auto">
        <TopBar />

        <div className="px-4 sm:px-6 mt-4">
          <div className="bg-white border-2 border-[#111111] brut-shadow p-4 flex items-center gap-3">
            <div className="w-11 h-11 bg-[#111111] text-[#FFE973] border-2 border-[#111111] flex items-center justify-center">
              <Bookmark size={20} strokeWidth={2.75} fill="currentColor" />
            </div>
            <div>
              <div className="uppercase text-[10px] font-black tracking-[0.3em] text-[#8A8A8A]">Your bookmarks</div>
              <div className="font-heading font-black text-2xl tracking-tighter leading-none">Saved posts</div>
            </div>
          </div>
        </div>

        <main className="px-4 sm:px-6 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} />
            </div>
          ) : posts.length === 0 ? (
            <div data-testid="saved-empty" className="bg-white border-2 border-[#111111] brut-shadow p-8 text-center">
              <Bookmark size={36} strokeWidth={2} className="mx-auto mb-3 text-[#8A8A8A]" />
              <div className="font-heading font-black text-xl mb-1">No saved posts yet</div>
              <p className="text-sm text-[#8A8A8A] font-medium">
                Tap the bookmark icon on a post to save it here for later.
              </p>
            </div>
          ) : (
            <div data-testid="saved-list">
              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  onCommentsClick={(post) => setCommentsFor(post)}
                  onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav onCreate={() => setCreateOpen(true)} />
      <CreatePostDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
      <CommentsSheet post={commentsFor} open={!!commentsFor} onClose={() => setCommentsFor(null)} />
    </div>
  );
}
