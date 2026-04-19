import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import PostCard from "@/components/PostCard";
import CommentsSheet from "@/components/CommentsSheet";
import CreatePostDialog from "@/components/CreatePostDialog";
import Avatar from "@/components/Avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { shortCount } from "@/lib/utils-social";
import { Loader2, MapPin, UserPlus, UserCheck, Pencil, Grid3x3, Heart, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Profile() {
  const { user: me, refresh } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();
  const targetId = userId || me?.id;
  const isMe = !userId || userId === me?.id;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [tab, setTab] = useState("posts");
  const [commentsFor, setCommentsFor] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const [u, p] = await Promise.all([
        api.get(`/users/${targetId}`),
        api.get(`/users/${targetId}/posts`),
      ]);
      setProfile(u.data);
      setPosts(p.data);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => { load(); }, [load]);

  // If viewing a business profile, redirect to shop page
  useEffect(() => {
    if (profile && profile.account_type === "business" && userId) {
      navigate(`/shop/${profile.id}`, { replace: true });
    }
  }, [profile, userId, navigate]);

  const onFollow = async () => {
    if (followBusy || !profile) return;
    setFollowBusy(true);
    try {
      const { data } = await api.post(`/users/${profile.id}/follow`);
      setProfile((p) => ({
        ...p,
        is_following: data.following,
        followers_count: data.followers_count,
      }));
      toast.success(data.following ? `Following ${profile.name}` : `Unfollowed ${profile.name}`);
    } finally {
      setFollowBusy(false);
    }
  };

  const totalLikes = posts.reduce((a, p) => a + (p.likes || 0), 0);
  const offers = posts.filter((p) => p.type === "offer").length;

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#FFFDF5] pb-20">
        <TopBar />
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} />
        </div>
        <BottomNav onCreate={() => setCreateOpen(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-28">
      <div className="max-w-2xl mx-auto">
        <TopBar />

        <section data-testid="profile-card" className="px-4 sm:px-6 mt-4">
          <div className="bg-white border-2 border-[#111111] brut-shadow p-5 enter-up">
            <div className="flex items-start gap-4">
              <Avatar name={profile.name} path={profile.avatar_path} size={84} />
              <div className="flex-1 min-w-0">
                <h1 data-testid="profile-name" className="font-heading font-black text-xl sm:text-2xl tracking-tighter leading-none truncate">
                  {profile.name}
                </h1>
                <div className="flex items-center gap-1 text-xs text-[#8A8A8A] font-semibold mt-1">
                  <MapPin size={11} strokeWidth={2.75} />
                  <span data-testid="profile-area" className="truncate">{profile.area}</span>
                </div>
                {profile.bio && (
                  <p data-testid="profile-bio" className="mt-2 text-[13.5px] leading-snug font-medium whitespace-pre-wrap break-words">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-[#FFFDF5] border-2 border-[#111111] p-2 text-center">
                <div className="font-heading font-black text-lg leading-none" data-testid="profile-stat-posts">{posts.length}</div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8A8A8A] mt-1">Posts</div>
              </div>
              <div className="bg-[#FFFDF5] border-2 border-[#111111] p-2 text-center">
                <div className="font-heading font-black text-lg leading-none" data-testid="profile-stat-followers">
                  {shortCount(profile.followers_count)}
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8A8A8A] mt-1">Followers</div>
              </div>
              <div className="bg-[#FFFDF5] border-2 border-[#111111] p-2 text-center">
                <div className="font-heading font-black text-lg leading-none" data-testid="profile-stat-following">
                  {shortCount(profile.following_count)}
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8A8A8A] mt-1">Following</div>
              </div>
            </div>

            {/* Action button */}
            <div className="mt-4">
              {isMe ? (
                <button
                  onClick={() => navigate("/profile/edit")}
                  data-testid="edit-profile-btn"
                  className="w-full bg-white text-[#111111] border-2 border-[#111111] brut-press font-heading font-black uppercase tracking-wider text-sm py-2.5 flex items-center justify-center gap-2"
                >
                  <Pencil size={14} strokeWidth={2.75} /> Edit profile
                </button>
              ) : (
                <button
                  onClick={onFollow}
                  disabled={followBusy}
                  data-testid="follow-btn"
                  className={`w-full border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm py-2.5 flex items-center justify-center gap-2 ${
                    profile.is_following ? "bg-white text-[#111111]" : "bg-[#FF5E5E] text-white"
                  }`}
                >
                  {followBusy ? <Loader2 size={14} className="animate-spin" /> : profile.is_following ? <UserCheck size={14} strokeWidth={3} /> : <UserPlus size={14} strokeWidth={3} />}
                  {profile.is_following ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Quick meta row */}
        <section className="px-4 sm:px-6 mt-4 grid grid-cols-2 gap-3">
          <div className="bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow-sm p-3">
            <div className="flex items-center gap-1 font-heading font-black text-xl leading-none" data-testid="profile-total-likes">
              <Heart size={16} strokeWidth={3} fill="currentColor" />{totalLikes}
            </div>
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/80 mt-1">Total likes received</div>
          </div>
          <div className="bg-[#FFE973] border-2 border-[#111111] brut-shadow-sm p-3">
            <div className="flex items-center gap-1 font-heading font-black text-xl leading-none" data-testid="profile-total-offers">
              <Megaphone size={16} strokeWidth={3} />{offers}
            </div>
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#111111]/70 mt-1">Offers posted</div>
          </div>
        </section>

        {/* Tabs */}
        <div className="px-4 sm:px-6 mt-6 flex gap-2 border-b-2 border-[#111111]/20">
          <button
            onClick={() => setTab("posts")}
            data-testid="tab-posts"
            className={`flex items-center gap-1.5 pb-2 px-2 font-heading font-black text-[11px] uppercase tracking-[0.22em] border-b-[3px] -mb-[2px] ${
              tab === "posts" ? "border-[#FF5E5E] text-[#111111]" : "border-transparent text-[#8A8A8A]"
            }`}
          >
            <Grid3x3 size={13} strokeWidth={3} /> Posts
          </button>
        </div>

        {/* Posts list */}
        <main className="px-4 sm:px-6 mt-5">
          {posts.length === 0 ? (
            <div className="bg-white border-2 border-[#111111] brut-shadow p-8 text-center">
              <div className="font-heading font-black text-xl mb-1">Nothing posted yet</div>
              <p className="text-sm text-[#8A8A8A] font-medium">
                {isMe ? "Share something with your neighbours!" : "This neighbour hasn't posted yet."}
              </p>
            </div>
          ) : (
            <div data-testid="profile-posts-list">
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
      <CommentsSheet
        post={commentsFor}
        open={!!commentsFor}
        onClose={() => setCommentsFor(null)}
        onCountChange={(postId, count) => setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments_count: count } : p)))}
      />
    </div>
  );
}
