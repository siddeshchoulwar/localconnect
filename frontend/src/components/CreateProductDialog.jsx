import React, { useRef, useState } from "react";
import { X, Send, Loader2, Image as ImageIcon, Tag, Check, Trash2 } from "lucide-react";
import { api, mediaUrl, uploadImage, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { BUSINESS_CATEGORIES } from "@/lib/utils-social";

const PROD_CATEGORIES = [
  "meal", "snack", "dessert", "beverage", "fruit", "vegetable", "dairy",
  "bakery", "grocery", "retail", "service", "other",
];

export default function CreateProductDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", description: "", price: "", category: "meal", is_offer: false });
  const [imagePath, setImagePath] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const reset = () => {
    setForm({ name: "", description: "", price: "", category: "meal", is_offer: false });
    setImagePath(null); setSaving(false); setUploading(false);
  };
  const close = () => { if (!saving && !uploading) { reset(); onClose?.(); } };

  const onPick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Choose an image");
    if (f.size > 6 * 1024 * 1024) return toast.error("Max 6MB");
    setUploading(true);
    try {
      const r = await uploadImage(f);
      setImagePath(r.path);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Upload failed"); }
    finally { setUploading(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) return toast.error("Product name required");
    if (!form.price || isNaN(Number(form.price))) return toast.error("Valid price required");
    setSaving(true);
    try {
      const { data } = await api.post("/products", {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        category: form.category,
        image_path: imagePath,
        is_offer: form.is_offer,
        is_available: true,
      });
      toast.success(form.is_offer ? "Offer listed!" : "Product added");
      onCreated?.(data);
      reset(); onClose?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not save");
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#111111]/50" onClick={close} data-testid="create-product-dialog">
      <div onClick={(e) => e.stopPropagation()} className="bg-[#FFFDF5] border-2 border-[#111111] brut-shadow w-full sm:max-w-lg max-h-[92vh] overflow-hidden flex flex-col enter-up">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#111111] bg-white">
          <div className="font-heading font-black text-lg tracking-tighter">Add to shop</div>
          <button onClick={close} data-testid="create-product-close-btn" className="w-8 h-8 border-2 border-[#111111] brut-press bg-white flex items-center justify-center">
            <X size={14} strokeWidth={3} />
          </button>
        </div>

        <form onSubmit={save} className="p-4 overflow-y-auto">
          {imagePath && (
            <div className="relative border-2 border-[#111111] bg-[#111111] mb-3">
              <img src={mediaUrl(imagePath)} alt="" className="w-full h-48 object-cover" />
              <button type="button" onClick={() => setImagePath(null)} className="absolute top-2 right-2 w-8 h-8 bg-white border-2 border-[#111111] flex items-center justify-center">
                <Trash2 size={12} strokeWidth={2.75} className="text-[#FF5E5E]" />
              </button>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 border-2 border-[#111111] px-2.5 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press bg-[#C4A1FF]">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} strokeWidth={3} />}
              {uploading ? "Uploading" : imagePath ? "Replace image" : "Add image"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
            <button type="button" onClick={() => setForm({ ...form, is_offer: !form.is_offer })} data-testid="product-offer-toggle" className={`flex items-center gap-1.5 border-2 border-[#111111] px-2.5 py-1.5 font-heading font-black text-[11px] uppercase tracking-wider brut-press ${form.is_offer ? "bg-[#FFE973]" : "bg-white"}`}>
              {form.is_offer ? <Check size={12} strokeWidth={3} /> : <Tag size={12} strokeWidth={3} />}
              {form.is_offer ? "Listed as offer" : "Mark as offer"}
            </button>
          </div>

          <label className="block mb-3">
            <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Item / Product name</span>
            <input data-testid="product-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Veg Thali, Cold Brew" className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none" />
          </label>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Price (₹)</span>
              <input data-testid="product-price-input" type="number" min={0} step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none" />
            </label>
            <label className="block">
              <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Category</span>
              <select data-testid="product-category-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none">
                {PROD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <label className="block mb-3">
            <span className="uppercase text-[10px] font-black tracking-[0.25em] mb-1 block">Description</span>
            <textarea data-testid="product-desc-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 300) })} rows={3} placeholder="What makes it great?" className="w-full border-2 border-[#111111] bg-white px-3 py-2.5 font-medium focus:outline-none resize-none" />
          </label>

          <button type="submit" data-testid="product-save-btn" disabled={saving} className="w-full bg-[#FF5E5E] text-white border-2 border-[#111111] brut-shadow brut-press font-heading font-black uppercase tracking-wider text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={3} />}
            List item
          </button>
        </form>
      </div>
    </div>
  );
}
