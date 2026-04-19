import React, { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import { getBrowserLocation } from "@/lib/geo";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const DISMISS_KEY = "lc_location_dismissed";

export default function LocationPrompt() {
  const { user, updateLocation } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || typeof user !== "object") return;
    if (user.lat != null && user.lng != null) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setVisible(true);
  }, [user]);

  if (!visible) return null;

  const enable = async () => {
    setLoading(true);
    try {
      const loc = await getBrowserLocation();
      await updateLocation(loc.lat, loc.lng);
      toast.success("Location enabled — discovering your 5 km radius");
      setVisible(false);
    } catch (e) {
      toast.error("Couldn't get your location. You can enable it later in Profile.");
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div data-testid="location-prompt" className="fixed top-[72px] left-3 right-3 z-30 sm:max-w-xl sm:mx-auto">
      <div className="bg-[#FFE973] border-2 border-[#111111] brut-shadow p-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-[#111111] text-[#FFE973] border-2 border-[#111111] flex items-center justify-center shrink-0">
          <MapPin size={18} strokeWidth={2.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-black text-sm leading-tight">Enable location for 5 km radius</div>
          <div className="text-[11px] font-semibold text-[#111111]/70">Discover shops, offers & events near you.</div>
        </div>
        <button onClick={enable} disabled={loading} data-testid="enable-location-btn" className="bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow-sm brut-press font-heading font-black text-[11px] uppercase tracking-wider px-3 py-1.5">
          {loading ? "…" : "Enable"}
        </button>
        <button onClick={dismiss} data-testid="dismiss-location-btn" className="w-8 h-8 border-2 border-[#111111] bg-white brut-press flex items-center justify-center" aria-label="Dismiss">
          <X size={12} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
