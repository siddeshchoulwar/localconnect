import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import NearbyMap from "@/components/NearbyMap";
import Avatar from "@/components/Avatar";
import CreateEventDialog from "@/components/CreateEventDialog";
import { api, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { timeAgo } from "@/lib/utils-social";
import { formatDistance } from "@/lib/geo";
import { Loader2, MapPin, Calendar, CheckCircle2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nearby, setNearby] = useState(user?.lat != null);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/events", { params: { nearby: nearby && user?.lat != null } });
      setEvents(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [nearby, user?.lat]);

  const onGoing = async (ev) => {
    try {
      const { data } = await api.post(`/events/${ev.id}/going`);
      setEvents((prev) => prev.map((x) => x.id === ev.id ? { ...x, going: data.going, attendees_count: data.attendees_count } : x));
      toast.success(data.going ? "You're going!" : "Removed from going");
    } catch { toast.error("Could not update"); }
  };

  const mapMarkers = events
    .filter((e) => e.lat != null && e.lng != null)
    .map((e) => ({ id: e.id, lat: e.lat, lng: e.lng, kind: "event", label: e.title, sub: e.location_name }));

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-28">
      <div className="max-w-2xl mx-auto">
        <TopBar />

        <div className="px-4 sm:px-6 mt-4">
          <div className="bg-[#C4A1FF] border-2 border-[#111111] brut-shadow p-4 flex items-center gap-3">
            <Calendar size={32} strokeWidth={2.75} className="shrink-0" />
            <div className="flex-1">
              <div className="uppercase text-[10px] font-black tracking-[0.3em] text-[#111111]/60">What's happening</div>
              <div className="font-heading font-black text-2xl sm:text-3xl tracking-tighter leading-none">In your area</div>
            </div>
            <button onClick={() => setNearby((n) => !n)} data-testid="events-toggle-nearby" className={`border-2 border-[#111111] px-2.5 py-1.5 font-heading font-black text-[10px] uppercase tracking-wider brut-press ${nearby ? "bg-[#111111] text-[#FFE973]" : "bg-white"}`}>
              {nearby ? "5 km" : "Area"}
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 mt-4">
          <NearbyMap
            center={user?.lat != null ? { lat: user.lat, lng: user.lng } : null}
            markers={mapMarkers}
            height={220}
          />
        </div>

        <div className="px-4 sm:px-6 mt-4 flex justify-end">
          <button onClick={() => setCreateOpen(true)} data-testid="create-event-btn" className="bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-xs px-3 py-2 flex items-center gap-1.5">
            <Plus size={13} strokeWidth={3} /> Post an event
          </button>
        </div>

        <main className="px-4 sm:px-6 mt-4">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} /></div>
          ) : events.length === 0 ? (
            <div data-testid="events-empty" className="bg-white border-2 border-[#111111] brut-shadow p-8 text-center">
              <Calendar size={36} strokeWidth={2} className="mx-auto mb-3 text-[#8A8A8A]" />
              <div className="font-heading font-black text-xl mb-1">Nothing happening yet</div>
              <p className="text-sm text-[#8A8A8A] font-medium">Be the first to post a meetup, cleanup, or event.</p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="events-list">
              {events.map((ev) => (
                <article key={ev.id} data-testid={`event-card-${ev.id}`} className="bg-white border-2 border-[#111111] brut-shadow p-4">
                  {ev.image_path && (
                    <div className="border-2 border-[#111111] bg-[#111111] mb-3 -mx-4 -mt-4">
                      <img src={mediaUrl(ev.image_path)} alt="" className="w-full max-h-64 object-cover" />
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <Avatar name={ev.user_name} path={ev.user_avatar_path} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-black text-lg leading-tight">{ev.title}</div>
                      <div className="text-[11px] font-bold text-[#8A8A8A]">by {ev.user_name} · {timeAgo(ev.created_at)}</div>
                    </div>
                  </div>

                  {ev.description && <p className="mt-2 text-[14px] leading-snug font-medium whitespace-pre-wrap">{ev.description}</p>}

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {ev.event_date && (
                      <div className="bg-[#FFFDF5] border-2 border-[#111111] p-2 text-[11px] font-bold flex items-center gap-1.5">
                        <Calendar size={12} strokeWidth={2.75} />
                        {new Date(ev.event_date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                    {(ev.location_name || ev.area) && (
                      <div className="bg-[#FFFDF5] border-2 border-[#111111] p-2 text-[11px] font-bold flex items-center gap-1.5">
                        <MapPin size={12} strokeWidth={2.75} />
                        <span className="truncate">{ev.location_name || ev.area}</span>
                        {ev.distance_km != null && <span className="text-[#FF5E5E] ml-auto">{formatDistance(ev.distance_km)}</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="text-[11px] font-bold text-[#8A8A8A] flex items-center gap-1">
                      <Users size={12} strokeWidth={2.75} /> {ev.attendees_count} going
                    </div>
                    <button onClick={() => onGoing(ev)} data-testid={`event-going-btn-${ev.id}`} className={`border-2 border-[#111111] brut-press font-heading font-black uppercase tracking-wider text-xs px-3 py-1.5 flex items-center gap-1.5 ${ev.going ? "bg-[#111111] text-[#FFE973]" : "bg-[#FFE973]"}`}>
                      {ev.going ? <><CheckCircle2 size={12} strokeWidth={3} /> Going</> : "I'm in"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav onCreate={() => navigate("/feed")} />
      <CreateEventDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(ev) => setEvents((prev) => [ev, ...prev])} />
    </div>
  );
}
