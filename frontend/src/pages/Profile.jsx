import React, { useEffect, useState } from "react";
import Header from "@/components/Header";
import PostCard from "@/components/PostCard";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "react-router-dom";
import { Loader2, MapPin, Mail, Calendar, Heart } from "lucide-react";

function initials(name = "") {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function Profile() {
  const { user: me } = useAuth();
  const { userId } = useParams();
  const targetId = userId || me?.id;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetId) return;
    let ok = true;
    (async () => {
      setLoading(true);
      try {
        const [u, p] = await Promise.all([
          api.get(`/users/${targetId}`),
          api.get(`/users/${targetId}/posts`),
        ]);
        if (!ok) return;
        setProfile(u.data);
        setPosts(p.data);
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => { ok = false; };
  }, [targetId]);

  const totalLikes = posts.reduce((a, p) => a + (p.likes || 0), 0);
  const offers = posts.filter((p) => p.type === "offer").length;

  return (
    <div className="min-h-screen bg-[#FFFDF5]">
      <div className="w-full max-w-lg mx-auto sm:border-x-2 border-[#111111] min-h-screen">
        <Header />

        <main className="p-4 sm:p-6">
          {loading || !profile ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} />
            </div>
          ) : (
            <>
              <section
                data-testid="profile-card"
                className="bg-white border-2 border-[#111111] brut-shadow p-6 mb-6 enter-up"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-16 h-16 bg-[#FFE973] border-2 border-[#111111] brut-shadow-sm flex items-center justify-center font-heading font-black text-2xl"
                    data-testid="profile-avatar"
                  >
                    {initials(profile.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1
                      data-testid="profile-name"
                      className="font-heading font-black text-2xl sm:text-3xl tracking-tighter leading-none truncate"
                    >
                      {profile.name}
                    </h1>
                    <div className="mt-1 flex items-center gap-1 text-xs text-[#8A8A8A] font-semibold">
                      <MapPin size={12} strokeWidth={2.75} />
                      <span data-testid="profile-area" className="truncate">{profile.area}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-sm font-medium border-t-2 border-dashed border-[#111111] pt-3">
                  <div className="flex items-center gap-2">
                    <Mail size={13} strokeWidth={2.75} className="text-[#8A8A8A]" />
                    <span className="text-[#111111]" data-testid="profile-email">{profile.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={13} strokeWidth={2.75} className="text-[#8A8A8A]" />
                    <span className="text-[#111111]">
                      Joined {new Date(profile.created_at).toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mt-5">
                  <div className="bg-[#FFFDF5] border-2 border-[#111111] p-3 text-center">
                    <div className="font-heading font-black text-2xl leading-none" data-testid="profile-stat-posts">{posts.length}</div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8A8A8A] mt-1">Posts</div>
                  </div>
                  <div className="bg-[#FF5E5E] text-white border-2 border-[#111111] p-3 text-center">
                    <div className="flex items-center justify-center gap-1 font-heading font-black text-2xl leading-none" data-testid="profile-stat-likes">
                      <Heart size={16} strokeWidth={3} fill="currentColor" />{totalLikes}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/80 mt-1">Likes</div>
                  </div>
                  <div className="bg-[#FFE973] border-2 border-[#111111] p-3 text-center">
                    <div className="font-heading font-black text-2xl leading-none" data-testid="profile-stat-offers">{offers}</div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#111111]/70 mt-1">Offers</div>
                  </div>
                </div>
              </section>

              <div className="uppercase text-[10px] font-black tracking-[0.3em] mb-3 flex items-center gap-2">
                <span className="h-0.5 w-6 bg-[#111111]" /> Recent posts
              </div>

              {posts.length === 0 ? (
                <div className="bg-white border-2 border-[#111111] brut-shadow p-8 text-center">
                  <div className="font-heading font-black text-xl mb-1">Nothing posted yet</div>
                  <p className="text-sm text-[#8A8A8A] font-medium">
                    {profile.id === me?.id ? "Head to the feed and share something!" : "This neighbour hasn't posted yet."}
                  </p>
                </div>
              ) : (
                <div data-testid="profile-posts-list">
                  {posts.map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
