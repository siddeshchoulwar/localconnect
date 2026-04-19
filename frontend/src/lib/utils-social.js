export function timeAgo(iso) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${Math.max(1, s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function initials(name = "") {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = ["#FF5E5E", "#C4A1FF", "#FFE973", "#7DE2A1", "#8DD3FE", "#FFB572", "#FF9EC7", "#B4E66E"];
export function colorFor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function shortCount(n) {
  if (n == null) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatPrice(n) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// Renders text with @mentions highlighted as links-styling
export function renderWithMentions(text) {
  if (!text) return null;
  const parts = text.split(/(@[a-zA-Z][a-zA-Z0-9_]{1,30})/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="text-[#FF5E5E] font-heading font-black">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export const BUSINESS_CATEGORIES = [
  { key: "food", label: "Food", emoji: "🍱" },
  { key: "grocery", label: "Grocery", emoji: "🛒" },
  { key: "cafe", label: "Cafés", emoji: "☕" },
  { key: "retail", label: "Retail", emoji: "🛍️" },
  { key: "services", label: "Services", emoji: "🧰" },
  { key: "health", label: "Health", emoji: "💊" },
  { key: "other", label: "Other", emoji: "✨" },
];
