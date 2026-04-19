import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import CreatePostDialog from "@/components/CreatePostDialog";
import CommentsSheet from "@/components/CommentsSheet";
import { api, mediaUrl } from "@/lib/api";
import { Loader2, Heart, MessageCircle, Tag, Flame } from "lucide-react";

export default function Explore() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/explore");
        if (!cancel) setPosts(data);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-20">
      <div className="max-w-2xl mx-auto">
        <TopBar />

        <div className="px-4 sm:px-6 mt-4">
          <div className="bg-[#111111] text-[#FFE973] border-2 border-[#111111] brut-shadow p-4 flex items-center gap-3">
            <Flame size={28} strokeWidth={2.75} className="text-[#FF5E5E] shrink-0" />
            <div>
              <div className="uppercase text-[10px] font-black tracking-[0.3em] text-[#FFE973]/70">Trending</div>
              <div className="font-heading font-black text-2xl tracking-tighter leading-none">Across neighbourhoods</div>
            </div>
          </div>
        </div>

        <main className="px-4 sm:px-6 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} />
            </div>
          ) : posts.length === 0 ? (
            <div data-testid="explore-empty" className="bg-white border-2 border-[#111111] brut-shadow p-8 text-center">
              <div className="font-heading font-black text-xl mb-1">Nothing trending yet</div>
              <p className="text-sm text-[#8A8A8A] font-medium">Come back soon for what's heating up nearby.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3" data-testid="explore-grid">
              {posts.map((p) => {
                const img = mediaUrl(p.image_path);
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/profile/${p.user_id}`)}
                    data-testid={`explore-tile-${p.id}`}
                    className={`text-left border-2 border-[#111111] brut-shadow-sm brut-press overflow-hidden ${
                      p.type === "offer" ? "bg-[#FFE973]" : "bg-white"
                    }`}
                  >
                    {img ? (
                      <div className="aspect-square bg-[#111111]">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={`aspect-square flex items-center justify-center p-3 text-center font-heading font-black text-sm leading-tight ${
                        p.type === "offer" ? "bg-[#FFE973]" : "bg-[#C4A1FF]"
                      }`}>
                        {p.content.slice(0, 80)}
                      </div>
                    )}
                    <div className="p-2">
                      <div className="flex items-center gap-2 text-[10px] font-black">
                        <span className="flex items-center gap-0.5">
                          <Heart size={11} strokeWidth={3} fill={p.liked ? "#FF5E5E" : "none"} /> {p.likes}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle size={11} strokeWidth={3} /> {p.comments_count}
                        </span>
                        {p.type === "offer" && (
                          <span className="ml-auto bg-[#FF5E5E] text-white px-1.5 py-0.5 border border-[#111111] text-[9px] uppercase tracking-widest flex items-center gap-0.5">
                            <Tag size={9} strokeWidth={3} /> Offer
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-[#8A8A8A] mt-1 truncate">
                        {p.user_name} · {p.area}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <BottomNav onCreate={() => setCreateOpen(true)} />
      <CreatePostDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => setCreateOpen(false)} />
      <CommentsSheet post={commentsFor} open={!!commentsFor} onClose={() => setCommentsFor(null)} />
    </div>
  );
}
