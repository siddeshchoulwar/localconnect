import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import Avatar from "@/components/Avatar";
import CreateProductDialog from "@/components/CreateProductDialog";
import { api, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatPrice, BUSINESS_CATEGORIES } from "@/lib/utils-social";
import { formatDistance } from "@/lib/geo";
import { Loader2, MapPin, Tag, Phone, Plus, Trash2, UserPlus, UserCheck, Store } from "lucide-react";
import { toast } from "sonner";

export default function BusinessDetail() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const isMe = shop && me && shop.id === me.id;

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [u, p] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/products`, { params: { business_id: userId } }),
      ]);
      setShop(u.data);
      setProducts(p.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userId]);

  const onFollow = async () => {
    if (followBusy || !shop) return;
    setFollowBusy(true);
    try {
      const { data } = await api.post(`/users/${shop.id}/follow`);
      setShop((s) => ({ ...s, is_following: data.following, followers_count: data.followers_count }));
    } finally { setFollowBusy(false); }
  };

  const onDeleteProduct = async (pid) => {
    if (!window.confirm("Remove this item?")) return;
    try {
      await api.delete(`/products/${pid}`);
      setProducts((prev) => prev.filter((p) => p.id !== pid));
      toast.success("Item removed");
    } catch { toast.error("Could not remove"); }
  };

  if (loading || !shop) {
    return (
      <div className="min-h-screen bg-[#FFFDF5] pb-28">
        <TopBar />
        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-[#FF5E5E]" strokeWidth={2.5} /></div>
        <BottomNav onCreate={() => navigate("/feed")} />
      </div>
    );
  }

  const cat = BUSINESS_CATEGORIES.find((c) => c.key === shop.business_category);

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-28">
      <div className="max-w-2xl mx-auto">
        <TopBar />

        <section className="px-4 sm:px-6 mt-4">
          <div className="bg-white border-2 border-[#111111] brut-shadow p-5" data-testid="shop-card">
            <div className="flex items-start gap-4">
              <Avatar name={shop.business_name || shop.name} path={shop.shop_image_path || shop.avatar_path} size={84} />
              <div className="flex-1 min-w-0">
                <h1 data-testid="shop-name" className="font-heading font-black text-xl sm:text-2xl tracking-tighter leading-none truncate flex items-center gap-1">
                  {shop.business_name || shop.name}
                  <Store size={16} strokeWidth={2.75} className="text-[#FF5E5E]" />
                </h1>
                <div className="text-xs text-[#8A8A8A] font-semibold mt-1">
                  {cat?.emoji} {cat?.label || shop.business_category}
                </div>
                <div className="flex items-center gap-1 text-xs text-[#8A8A8A] font-semibold mt-0.5">
                  <MapPin size={11} strokeWidth={2.75} />
                  <span className="truncate">{shop.area}</span>
                  {shop.distance_km != null && <span className="text-[#FF5E5E]"> · {formatDistance(shop.distance_km)}</span>}
                </div>
                {shop.bio && <p className="mt-2 text-[13px] leading-snug font-medium" data-testid="shop-bio">{shop.bio}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-[#FFFDF5] border-2 border-[#111111] p-2 text-center">
                <div className="font-heading font-black text-lg leading-none">{products.length}</div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8A8A8A] mt-1">Items</div>
              </div>
              <div className="bg-[#FFFDF5] border-2 border-[#111111] p-2 text-center">
                <div className="font-heading font-black text-lg leading-none">{shop.followers_count}</div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8A8A8A] mt-1">Followers</div>
              </div>
              <div className="bg-[#FFE973] border-2 border-[#111111] p-2 text-center">
                <div className="font-heading font-black text-lg leading-none">{products.filter((p) => p.is_offer).length}</div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#111111]/70 mt-1">Offers</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {isMe ? (
                <button onClick={() => setCreateOpen(true)} data-testid="add-product-btn" className="flex-1 bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm py-2.5 flex items-center justify-center gap-2">
                  <Plus size={14} strokeWidth={3} /> Add item / offer
                </button>
              ) : (
                <>
                  <button onClick={onFollow} disabled={followBusy} data-testid="shop-follow-btn" className={`flex-1 border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm py-2.5 flex items-center justify-center gap-2 ${shop.is_following ? "bg-white" : "bg-[#FF5E5E] text-white"}`}>
                    {followBusy ? <Loader2 size={14} className="animate-spin" /> : shop.is_following ? <UserCheck size={14} strokeWidth={3} /> : <UserPlus size={14} strokeWidth={3} />}
                    {shop.is_following ? "Following" : "Follow"}
                  </button>
                  {shop.phone && (
                    <a href={`tel:${shop.phone}`} data-testid="shop-call-btn" className="px-4 bg-[#FFE973] border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                      <Phone size={14} strokeWidth={3} /> Call
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <main className="px-4 sm:px-6 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="font-heading font-black text-xs uppercase tracking-[0.25em]">Menu / Products</div>
          </div>

          {products.length === 0 ? (
            <div data-testid="shop-empty" className="bg-white border-2 border-[#111111] brut-shadow p-6 text-center">
              <div className="font-heading font-black text-lg mb-1">No items yet</div>
              <p className="text-xs text-[#8A8A8A] font-medium">
                {isMe ? "Add your first item or offer to get discovered." : "This shop hasn't listed items yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3" data-testid="shop-products-grid">
              {products.map((p) => (
                <div key={p.id} data-testid={`product-card-${p.id}`} className={`relative border-2 border-[#111111] brut-shadow-sm overflow-hidden ${p.is_offer ? "bg-[#FFE973]" : "bg-white"}`}>
                  {p.is_offer && (
                    <span className="absolute top-2 left-2 bg-[#FF5E5E] text-white text-[10px] font-black px-2 py-0.5 border-2 border-[#111111] uppercase tracking-wider flex items-center gap-0.5 z-10">
                      <Tag size={10} strokeWidth={3} /> Offer
                    </span>
                  )}
                  {isMe && (
                    <button onClick={() => onDeleteProduct(p.id)} className="absolute top-2 right-2 w-7 h-7 bg-white border-2 border-[#111111] flex items-center justify-center z-10">
                      <Trash2 size={11} strokeWidth={2.75} className="text-[#FF5E5E]" />
                    </button>
                  )}
                  <div className="aspect-square bg-[#111111]">
                    {p.image_path ? (
                      <img src={mediaUrl(p.image_path)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center font-heading font-black text-center p-3 ${p.is_offer ? "bg-[#FFE973]" : "bg-[#C4A1FF]"}`}>
                        <div className="text-sm leading-tight">{p.name}</div>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="font-heading font-black text-sm leading-tight truncate">{p.name}</div>
                    {p.description && <div className="text-[11px] font-medium text-[#111111]/70 line-clamp-2 mt-0.5">{p.description}</div>}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="font-heading font-black text-base">{formatPrice(p.price)}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#8A8A8A]">{p.category}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav onCreate={() => navigate("/feed")} />
      <CreateProductDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(prod) => setProducts((prev) => [prod, ...prev])} />
    </div>
  );
}
