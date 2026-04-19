import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Brutalist pin icon (inline SVG)
function makeDivIcon(color = "#FF5E5E", label = "") {
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:32px;height:32px;background:${color};border:2px solid #111;box-shadow:2px 2px 0 0 #111;display:flex;align-items:center;justify-content:center;font-weight:900;font-family:'Cabinet Grotesk',sans-serif;font-size:14px;color:#111;">${label}</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid #111;margin-top:-2px;"></div>
    </div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -40],
  });
}

export default function NearbyMap({ center, radiusKm = 5, markers = [], height = 320 }) {
  useEffect(() => {
    // Leaflet default icon path fix (not needed since we use DivIcons, but harmless)
    delete L.Icon.Default.prototype._getIconUrl;
  }, []);

  if (!center) {
    return (
      <div style={{ height }} className="w-full border-2 border-[#111111] brut-shadow bg-white flex items-center justify-center text-xs font-bold text-[#8A8A8A]">
        Enable location to see the map
      </div>
    );
  }

  return (
    <div className="border-2 border-[#111111] brut-shadow overflow-hidden" data-testid="nearby-map">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        style={{ height, width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Circle
          center={[center.lat, center.lng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: "#111111", weight: 2, fillColor: "#FF5E5E", fillOpacity: 0.08 }}
        />
        <Marker position={[center.lat, center.lng]} icon={makeDivIcon("#FFE973", "YOU")}>
          <Popup>You are here</Popup>
        </Marker>
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={makeDivIcon(m.color || (m.kind === "business" ? "#C4A1FF" : "#FF5E5E"), m.kind === "business" ? "🏪" : "👤")}
          >
            <Popup>
              <div className="font-heading font-black text-sm">{m.label}</div>
              {m.sub && <div className="text-xs text-[#8A8A8A] font-semibold">{m.sub}</div>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
