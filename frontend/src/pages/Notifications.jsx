import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import Avatar from "@/components/Avatar";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/utils-social";
import { Loader2, Heart, MessageCircle, UserPlus, AtSign, Bell, UserCheck, Users } from "lucide-react";

const ICON = {
  like: <Heart size={14} strokeWidth={3} className="text-[#FF5E5E]" fill="currentColor" />,
  comment: <MessageCircle size={14} strokeWidth={3} className="text-[#FF5E5E]" />,
  follow: <UserPlus size={14} strokeWidth={3} className="text-[#FF5E5E]" />,
  mention: <AtSign size={14} strokeWidth={3} className="text-[#FF5E5E]" />,
  friend_request: <Users size={14} strokeWidth={3} className="text-[#FF5E5E]" />,
  friend_accept: <UserCheck size={14} strokeWidth={3} className="text-[#FF5E5E]" />,
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/notifications");
        setItems(data);
        // mark all read
        api.post("/notifications/read-all").catch(() => {});
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-28">
      <div className="max-w-2xl mx-auto">
        <TopBar />

        <div className="px-4 sm:px-6 mt-4">
          <div className="bg-white border-2 border-[#111111] brut-shadow p-4 flex items-center gap-3">
            <div className="w-11 h-11 bg-[#FF5E5E] text-white border-2 border-[#111111] flex items-center justify-center">
              <Bell size={20} strokeWidth={2.75} fill="currentColor" />
            </div>
            <div>
              <div className="uppercase text-[10px] font-black tracking-[0.3em] text-[#8A8A8A]">Activity</div>
              <div className="font-heading font-black text-2xl tracking-tighter leading-none">Notifications</div>
            </div>
          </div>
        </div>

        <main className="px-4 sm:px-6 mt-4">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} /></div>
          ) : items.length === 0 ? (
            <div data-testid="notif-empty" className="bg-white border-2 border-[#111111] brut-shadow p-8 text-center">
              <div className="font-heading font-black text-xl mb-1">No activity yet</div>
              <p className="text-sm text-[#8A8A8A] font-medium">Likes, comments, mentions & follows will show up here.</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="notif-list">
              {items.map((n) => {
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (n.type === "friend_request" || n.type === "friend_accept") navigate("/friends");
                      else if (n.target_post_id) navigate("/feed");
                      else if (n.actor_id) navigate(`/profile/${n.actor_id}`);
                    }}
                    data-testid={`notif-${n.id}`}
                    className={`w-full text-left flex items-center gap-3 border-2 border-[#111111] p-3 brut-shadow-sm brut-press ${n.read ? "bg-white" : "bg-[#FFE973]"}`}
                  >
                    <Avatar name={n.actor_name || "?"} path={n.actor_avatar_path} size={42} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        {ICON[n.type]}
                        <span className="font-heading font-black">{n.actor_name || "Someone"}</span>
                        <span className="text-[#111111]/70 truncate">{n.message.replace(n.actor_name + " ", "")}</span>
                      </div>
                      <div className="text-[11px] font-bold text-[#8A8A8A] mt-0.5">{timeAgo(n.created_at)}</div>
                    </div>
                    {!n.read && <span className="w-2 h-2 bg-[#FF5E5E] rounded-full shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <BottomNav onCreate={() => navigate("/feed")} />
    </div>
  );
}
