import React from "react";
import { mediaUrl } from "@/lib/api";
import { initials, colorFor } from "@/lib/utils-social";

export default function Avatar({ name = "", path = null, size = 40, ring = false, active = false, className = "" }) {
  const url = mediaUrl(path);
  const wrap = ring
    ? {
        padding: 2,
        borderRadius: "9999px",
        background: active
          ? "conic-gradient(from 180deg, #FF5E5E, #FFE973, #C4A1FF, #FF5E5E)"
          : "#E6E1D6",
      }
    : {};

  const bg = colorFor(name);

  const inner = (
    <div
      className={`relative overflow-hidden flex items-center justify-center font-heading font-black text-white select-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        border: "2px solid #111111",
        background: url ? "#fff" : bg,
        fontSize: Math.max(10, size * 0.38),
      }}
    >
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <span className="text-[#111111]" style={{ mixBlendMode: "difference", color: "#fff" }}>
          {initials(name)}
        </span>
      )}
    </div>
  );

  if (!ring) return inner;
  return (
    <div style={wrap} className="shrink-0">
      <div style={{ background: "#FFFDF5", padding: 2, borderRadius: "9999px" }}>{inner}</div>
    </div>
  );
}
