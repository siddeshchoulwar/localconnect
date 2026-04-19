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
import { Loader2, MapPin, UserPlus, UserCheck, Pencil, Grid3x3, Heart, Megaphone, Users, UserMinus, Clock, Check, PlusSquare } from "lucide-react";
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
  const [friendBusy, setFriendBusy] = useState(false);
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

  // Business accounts: redirect to /shop/:id always (own profile + viewing others)
  useEffect(() => {
    if (!loading && profile && profile.account_type === "business") {
      navigate(`/shop/${profile.id}`, { replace: true });
    }
  }, [loading, profile, navigate]);

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

  const onFriendAction = async () => {
    if (friendBusy || !profile) return;
    setFriendBusy(true);
    try {
      const s = profile.friendship_status;
      if (s === "none") {
        const { data } = await api.post(`/users/${profile.id}/friend-request`);
        setProfile((p) => ({ ...p, friendship_status: data.friendship_status }));
        toast.success(data.friendship_status === "friends" ? "You're now friends!" : "Friend request sent");
      } else if (s === "pending_out") {
        // find & cancel outgoing
        const { data } = await api.get("/friend-requests/outgoing");
        const req = data.find((r) => r.to_user_id === profile.id);
        if (req) await api.delete(`/friend-requests/${req.id}`);
        setProfile((p) => ({ ...p, friendship_status: "none" }));
        toast("Request cancelled");
      } else if (s === "pending_in") {
        // find & accept
        const { data } = await api.get("/friend-requests/incoming");
        const req = data.find((r) => r.from_user_id === profile.id);
        if (req) {
          await api.post(`/friend-requests/${req.id}/accept`);
          setProfile((p) => ({ ...p, friendship_status: "friends", friends_count: (p.friends_count || 0) + 1 }));
          toast.success(`You and ${profile.name} are now friends`);
        }
      } else if (s === "friends") {
        if (!window.confirm(`Remove ${profile.name} from friends?`)) {
          setFriendBusy(false);
          return;
        }
        await api.delete(`/friends/${profile.id}`);
        setProfile((p) => ({ ...p, friendship_status: "none", friends_count: Math.max(0, (p.friends_count || 0) - 1) }));
        toast("Removed from friends");
      }
    } catch (e) {
      toast.error("Action failed");
    } finally {
      setFriendBusy(false);
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
            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="bg-[#FFFDF5] border-2 border-[#111111] p-2 text-center">
                <div className="font-heading font-black text-lg leading-none" data-testid="profile-stat-posts">{posts.length}</div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8A8A8A] mt-1">Posts</div>
              </div>
              <button
                onClick={() => isMe && navigate("/friends")}
                data-testid="profile-stat-friends"
                className={`bg-[#FFE973] border-2 border-[#111111] p-2 text-center ${isMe ? "brut-press" : ""}`}
              >
                <div className="font-heading font-black text-lg leading-none">{shortCount(profile.friends_count)}</div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#111111]/70 mt-1">Friends</div>
              </button>
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

            {/* Action buttons */}
            <div className="mt-4">
              {isMe ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => navigate("/profile/edit")}
                    data-testid="edit-profile-btn"
                    className="bg-white text-[#111111] border-2 border-[#111111] brut-press font-heading font-black uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1.5"
                  >
                    <Pencil size={12} strokeWidth={2.75} /> Edit
                  </button>
                  <button
                    onClick={() => setCreateOpen(true)}
                    data-testid="profile-new-post-btn"
                    className="bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow-sm brut-press font-heading font-black uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1.5"
                  >
                    <PlusSquare size={12} strokeWidth={2.75} /> Post
                  </button>
                  <button
                    onClick={() => navigate("/friends")}
                    data-testid="profile-friends-btn"
                    className="bg-[#C4A1FF] border-2 border-[#111111] brut-press font-heading font-black uppercase tracking-wider text-[11px] py-2 flex items-center justify-center gap-1.5"
                  >
                    <Users size={12} strokeWidth={2.75} /> Friends
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const s = profile.friendship_status;
                    const label = s === "friends" ? "Friends" : s === "pending_out" ? "Cancel" : s === "pending_in" ? "Accept" : "Add friend";
                    const Icon = s === "friends" ? UserMinus : s === "pending_out" ? Clock : s === "pending_in" ? Check : UserPlus;
                    const bg = s === "friends" ? "bg-white" : s === "pending_out" ? "bg-white" : s === "pending_in" ? "bg-[#FFE973]" : "bg-[#C4A1FF]";
                    return (
                      <button
                        onClick={onFriendAction}
                        disabled={friendBusy}
                        data-testid="friend-action-btn"
                        className={`${bg} border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm py-2.5 flex items-center justify-center gap-2`}
                      >
                        {friendBusy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} strokeWidth={3} />}
                        {label}
                      </button>
                    );
                  })()}
                  <button
                    onClick={onFollow}
                    disabled={followBusy}
                    data-testid="follow-btn"
                    className={`border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm py-2.5 flex items-center justify-center gap-2 ${
                      profile.is_following ? "bg-white text-[#111111]" : "bg-[#FF5E5E] text-white"
                    }`}
                  >
                    {followBusy ? <Loader2 size={14} className="animate-spin" /> : profile.is_following ? <UserCheck size={14} strokeWidth={3} /> : <UserPlus size={14} strokeWidth={3} />}
                    {profile.is_following ? "Following" : "Follow"}
                  </button>
                </div>
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
