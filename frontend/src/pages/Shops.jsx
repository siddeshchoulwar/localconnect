import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import NearbyMap from "@/components/NearbyMap";
import Avatar from "@/components/Avatar";
import { api, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { BUSINESS_CATEGORIES, formatPrice } from "@/lib/utils-social";
import { formatDistance } from "@/lib/geo";
import { Loader2, MapPin, Tag, Store, Phone, Flame } from "lucide-react";

export default function Shops() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [nearby, setNearby] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const params = { nearby: nearby && user?.lat != null };
      if (category !== "all") params.category = category;
      const [b, p] = await Promise.all([
        api.get("/businesses", { params }),
        api.get("/products", { params: { ...params, offers_only: false } }),
      ]);
      setBusinesses(b.data);
      setProducts(p.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [category, nearby, user?.lat]);

  const offers = products.filter((p) => p.is_offer);

  const mapMarkers = businesses
    .filter((b) => b.lat && b.lng)
    .map((b) => ({
      id: b.id, lat: b.lat, lng: b.lng,
      kind: "business", label: b.business_name || b.name,
      sub: `${b.business_category || ""}${b.distance_km != null ? ` · ${formatDistance(b.distance_km)}` : ""}`,
    }));

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-28">
      <div className="max-w-2xl mx-auto">
        <TopBar />

        <div className="px-4 sm:px-6 mt-4">
          <div className="bg-[#FFE973] border-2 border-[#111111] brut-shadow p-4 flex items-center gap-3">
            <Store size={32} strokeWidth={2.75} className="shrink-0" />
            <div className="flex-1">
              <div className="uppercase text-[10px] font-black tracking-[0.3em] text-[#111111]/60">Neighbourhood</div>
              <div className="font-heading font-black text-2xl sm:text-3xl tracking-tighter leading-none">Shops & Offers</div>
              <div className="text-[11px] font-semibold text-[#111111]/70 mt-0.5">
                {nearby && user?.lat != null ? "Within 5 km of you" : "All across LocalConnect"}
              </div>
            </div>
            <button onClick={() => setNearby((n) => !n)} data-testid="toggle-nearby-btn" className={`border-2 border-[#111111] px-2.5 py-1.5 font-heading font-black text-[10px] uppercase tracking-wider brut-press ${nearby ? "bg-[#111111] text-[#FFE973]" : "bg-white"}`}>
                {nearby ? "Nearby" : "All"}
            </button>
          </div>
        </div>

        {/* Map */}
        <div className="px-4 sm:px-6 mt-4">
          <NearbyMap
            center={user?.lat != null ? { lat: user.lat, lng: user.lng } : null}
            markers={mapMarkers}
            height={260}
          />
        </div>

        {/* Category chips */}
        <div className="px-4 sm:px-6 mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setCategory("all")} data-testid="cat-all" className={`shrink-0 border-2 border-[#111111] px-3 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press ${category === "all" ? "bg-[#FF5E5E] text-white" : "bg-white"}`}>
            🏪 All
          </button>
          {BUSINESS_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCategory(c.key)} data-testid={`cat-${c.key}`} className={`shrink-0 border-2 border-[#111111] px-3 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press ${category === c.key ? "bg-[#FF5E5E] text-white" : "bg-white"}`}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <main className="px-4 sm:px-6 mt-4">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} /></div>
          ) : (
            <>
              {/* Offers strip */}
              {offers.length > 0 && (
                <section className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame size={14} strokeWidth={3} className="text-[#FF5E5E]" />
                    <div className="font-heading font-black text-xs uppercase tracking-[0.25em]">Hot offers</div>
                  </div>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                    {offers.map((p) => (
                      <button key={p.id} onClick={() => navigate(`/shop/${p.business_id}`)} data-testid={`offer-tile-${p.id}`} className="shrink-0 w-40 bg-[#FFE973] border-2 border-[#111111] brut-shadow-sm brut-press text-left">
                        <div className="aspect-square bg-[#111111]">
                          {p.image_path ? (
                            <img src={mediaUrl(p.image_path)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-heading font-black text-2xl text-[#FFE973]">
                              <Tag size={28} strokeWidth={2.5} />
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="font-heading font-black text-xs uppercase tracking-wider text-[#FF5E5E]">Offer</div>
                          <div className="font-heading font-black text-sm leading-tight truncate">{p.name}</div>
                          <div className="flex items-baseline justify-between mt-1">
                            <div className="text-[11px] font-semibold text-[#111111]/60 truncate">{p.business_name}</div>
                            <div className="font-heading font-black text-sm">{formatPrice(p.price)}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Businesses list */}
              <div className="font-heading font-black text-xs uppercase tracking-[0.25em] mb-2">Shops</div>
              {businesses.length === 0 ? (
                <div data-testid="shops-empty" className="bg-white border-2 border-[#111111] brut-shadow p-6 text-center">
                  <div className="font-heading font-black text-lg mb-1">No shops yet</div>
                  <p className="text-xs text-[#8A8A8A] font-medium">
                    {nearby ? "None within 5 km. Switch to All to see everywhere." : "Try a different category."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="shops-list">
                  {businesses.map((b) => (
                    <Link key={b.id} to={`/shop/${b.id}`} data-testid={`shop-row-${b.id}`} className="flex items-center gap-3 bg-white border-2 border-[#111111] brut-shadow-sm p-3 brut-press">
                      <Avatar name={b.business_name || b.name} path={b.shop_image_path || b.avatar_path} size={56} />
                      <div className="flex-1 min-w-0">
                        <div className="font-heading font-black text-base truncate">{b.business_name}</div>
                        <div className="text-[12px] font-bold text-[#8A8A8A] flex items-center gap-1 truncate">
                          {BUSINESS_CATEGORIES.find((c) => c.key === b.business_category)?.emoji || "✨"} {b.business_category} · {b.area}
                        </div>
                        {b.distance_km != null && (
                          <div className="text-[11px] font-semibold text-[#FF5E5E]">
                            {formatDistance(b.distance_km)}
                          </div>
                        )}
                      </div>
                      {b.phone && (
                        <a href={`tel:${b.phone}`} onClick={(e) => e.stopPropagation()} className="w-9 h-9 bg-[#FFE973] border-2 border-[#111111] flex items-center justify-center" aria-label="Call">
                          <Phone size={14} strokeWidth={2.75} />
                        </a>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <BottomNav onCreate={() => navigate("/feed")} />
    </div>
  );
}
