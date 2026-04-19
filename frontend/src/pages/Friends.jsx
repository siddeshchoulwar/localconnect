import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import Avatar from "@/components/Avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { timeAgo } from "@/lib/utils-social";
import { formatDistance } from "@/lib/geo";
import { Loader2, Users, Check, X, UserPlus, UserCheck, Clock, UserMinus, MapPin } from "lucide-react";
import { toast } from "sonner";

function Empty({ title, text }) {
  return (
    <div className="bg-white border-2 border-[#111111] brut-shadow p-8 text-center">
      <Users size={36} strokeWidth={2} className="mx-auto mb-3 text-[#8A8A8A]" />
      <div className="font-heading font-black text-xl mb-1">{title}</div>
      <p className="text-sm text-[#8A8A8A] font-medium">{text}</p>
    </div>
  );
}

export default function Friends() {
  const [tab, setTab] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const navigate = useNavigate();
  const { user: me } = useAuth();

  const load = async () => {
    setLoading(true);
    try {
      const [f, i, o] = await Promise.all([
        api.get("/friends"),
        api.get("/friend-requests/incoming"),
        api.get("/friend-requests/outgoing"),
      ]);
      setFriends(f.data);
      setIncoming(i.data);
      setOutgoing(o.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const setWorking = (id, v) => setBusy((b) => ({ ...b, [id]: v }));

  const accept = async (req) => {
    setWorking(req.id, true);
    try {
      await api.post(`/friend-requests/${req.id}/accept`);
      setIncoming((list) => list.filter((x) => x.id !== req.id));
      toast.success(`You and ${req.from_user_name} are now friends`);
      load();
    } catch { toast.error("Could not accept"); }
    finally { setWorking(req.id, false); }
  };

  const reject = async (req) => {
    setWorking(req.id, true);
    try {
      await api.post(`/friend-requests/${req.id}/reject`);
      setIncoming((list) => list.filter((x) => x.id !== req.id));
      toast("Request declined");
    } catch { toast.error("Could not decline"); }
    finally { setWorking(req.id, false); }
  };

  const cancel = async (req) => {
    setWorking(req.id, true);
    try {
      await api.delete(`/friend-requests/${req.id}`);
      setOutgoing((list) => list.filter((x) => x.id !== req.id));
      toast("Request cancelled");
    } catch { toast.error("Could not cancel"); }
    finally { setWorking(req.id, false); }
  };

  const unfriend = async (u) => {
    if (!window.confirm(`Remove ${u.name} from friends?`)) return;
    setWorking(u.id, true);
    try {
      await api.delete(`/friends/${u.id}`);
      setFriends((list) => list.filter((x) => x.id !== u.id));
      toast("Removed from friends");
    } catch { toast.error("Could not unfriend"); }
    finally { setWorking(u.id, false); }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-28">
      <div className="max-w-2xl mx-auto">
        <TopBar />

        <div className="px-4 sm:px-6 mt-4">
          <div className="bg-white border-2 border-[#111111] brut-shadow p-4 flex items-center gap-3">
            <div className="w-11 h-11 bg-[#C4A1FF] border-2 border-[#111111] flex items-center justify-center">
              <Users size={20} strokeWidth={2.75} />
            </div>
            <div>
              <div className="uppercase text-[10px] font-black tracking-[0.3em] text-[#8A8A8A]">Connections</div>
              <div className="font-heading font-black text-2xl tracking-tighter leading-none">Friends</div>
              <div className="text-[11px] font-semibold text-[#8A8A8A] mt-0.5">Send requests · accept · build your block</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-6 mt-4 flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "friends", label: `Friends · ${friends.length}` },
            { key: "incoming", label: `Requests${incoming.length ? ` · ${incoming.length}` : ""}`, hot: incoming.length > 0 },
            { key: "outgoing", label: `Sent · ${outgoing.length}` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`friends-tab-${t.key}`}
              className={`shrink-0 border-2 border-[#111111] px-3 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press ${
                tab === t.key ? "bg-[#111111] text-[#FFE973]" : t.hot ? "bg-[#FFE973]" : "bg-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <main className="px-4 sm:px-6 mt-4">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} /></div>
          ) : (
            <>
              {tab === "friends" && (
                friends.length === 0 ? (
                  <Empty title="No friends yet" text="Search neighbours in the top bar and send a request." />
                ) : (
                  <div className="space-y-3" data-testid="friends-list">
                    {friends.map((u) => (
                      <div key={u.id} data-testid={`friend-row-${u.id}`} className="flex items-center gap-3 bg-white border-2 border-[#111111] brut-shadow-sm p-3">
                        <Link to={`/profile/${u.id}`} className="shrink-0">
                          <Avatar name={u.name} path={u.avatar_path} size={48} />
                        </Link>
                        <Link to={`/profile/${u.id}`} className="flex-1 min-w-0">
                          <div className="font-heading font-black text-sm truncate">{u.name}</div>
                          <div className="flex items-center gap-1 text-[11px] text-[#8A8A8A] font-semibold">
                            <MapPin size={10} strokeWidth={2.75} />
                            <span className="truncate">{u.area}</span>
                            {u.distance_km != null && <span className="text-[#FF5E5E]"> · {formatDistance(u.distance_km)}</span>}
                          </div>
                        </Link>
                        <button onClick={() => unfriend(u)} disabled={busy[u.id]} data-testid={`unfriend-btn-${u.id}`} className="border-2 border-[#111111] bg-white brut-press font-heading font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 flex items-center gap-1">
                          {busy[u.id] ? <Loader2 size={11} className="animate-spin" /> : <UserMinus size={11} strokeWidth={3} />}
                          Unfriend
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === "incoming" && (
                incoming.length === 0 ? (
                  <Empty title="No requests" text="When someone sends you a friend request, it'll show up here." />
                ) : (
                  <div className="space-y-3" data-testid="incoming-list">
                    {incoming.map((r) => (
                      <div key={r.id} data-testid={`incoming-${r.id}`} className="flex items-center gap-3 bg-[#FFE973] border-2 border-[#111111] brut-shadow-sm p-3">
                        <Link to={`/profile/${r.from_user_id}`} className="shrink-0">
                          <Avatar name={r.from_user_name} path={r.from_user_avatar_path} size={48} />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="font-heading font-black text-sm truncate">{r.from_user_name}</div>
                          <div className="text-[11px] font-bold text-[#111111]/60">wants to be friends · {timeAgo(r.created_at)}</div>
                        </div>
                        <button onClick={() => accept(r)} disabled={busy[r.id]} data-testid={`accept-${r.id}`} className="bg-[#FF5E5E] text-white border-2 border-[#111111] brut-press font-heading font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 flex items-center gap-1">
                          {busy[r.id] ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} strokeWidth={3} />}
                          Accept
                        </button>
                        <button onClick={() => reject(r)} disabled={busy[r.id]} data-testid={`reject-${r.id}`} className="bg-white border-2 border-[#111111] brut-press font-heading font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 flex items-center gap-1">
                          <X size={11} strokeWidth={3} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === "outgoing" && (
                outgoing.length === 0 ? (
                  <Empty title="No pending requests" text="Send a friend request from someone's profile or search." />
                ) : (
                  <div className="space-y-3" data-testid="outgoing-list">
                    {outgoing.map((r) => (
                      <div key={r.id} data-testid={`outgoing-${r.id}`} className="flex items-center gap-3 bg-white border-2 border-[#111111] brut-shadow-sm p-3">
                        <Link to={`/profile/${r.to_user_id}`} className="shrink-0">
                          <Avatar name={r.to_user_name} path={r.from_user_avatar_path} size={48} />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="font-heading font-black text-sm truncate">{r.to_user_name}</div>
                          <div className="text-[11px] font-bold text-[#8A8A8A] flex items-center gap-1">
                            <Clock size={10} strokeWidth={2.75} /> Pending · {timeAgo(r.created_at)}
                          </div>
                        </div>
                        <button onClick={() => cancel(r)} disabled={busy[r.id]} data-testid={`cancel-${r.id}`} className="border-2 border-[#111111] bg-white brut-press font-heading font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5">
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </main>
      </div>

      <BottomNav onCreate={() => navigate("/feed")} />
    </div>
  );
}
