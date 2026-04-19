import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MapPin, User, LogOut, Home } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  const onFeed = location.pathname === "/feed";
  const onProfile = location.pathname.startsWith("/profile");

  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-50 bg-[#FFFDF5] border-b-2 border-[#111111]"
    >
      {/* Marquee ticker */}
      <div className="bg-[#111111] text-[#FFE973] overflow-hidden py-1 border-b-2 border-[#111111]">
        <div className="marquee-track whitespace-nowrap flex gap-8 font-heading text-xs tracking-[0.25em] uppercase font-black">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-8 shrink-0">
              <span>★ LOCALCONNECT LITE</span>
              <span>● YOUR HOOD, YOUR FEED</span>
              <span>★ OFFERS FROM NEIGHBOURS</span>
              <span>● POST · LIKE · DISCOVER</span>
              <span>★ LOCALCONNECT LITE</span>
              <span>● YOUR HOOD, YOUR FEED</span>
              <span>★ OFFERS FROM NEIGHBOURS</span>
              <span>● POST · LIKE · DISCOVER</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center px-4 sm:px-6 py-3">
        <Link to="/feed" className="flex items-center gap-2" data-testid="header-logo">
          <div className="w-9 h-9 bg-[#FF5E5E] border-2 border-[#111111] brut-shadow-sm flex items-center justify-center">
            <MapPin size={20} strokeWidth={2.75} className="text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-heading font-black text-lg tracking-tighter">LocalConnect</span>
            <span className="font-heading font-black text-[10px] uppercase tracking-[0.3em] text-[#8A8A8A]">Lite · MVP</span>
          </div>
        </Link>

        {user && typeof user === "object" && (
          <div className="flex items-center gap-2">
            <Link
              to="/feed"
              data-testid="nav-feed-btn"
              className={`w-10 h-10 border-2 border-[#111111] brut-press flex items-center justify-center ${
                onFeed ? "bg-[#FFE973]" : "bg-white"
              }`}
              aria-label="Feed"
            >
              <Home size={18} strokeWidth={2.5} />
            </Link>
            <Link
              to="/profile"
              data-testid="nav-profile-btn"
              className={`w-10 h-10 border-2 border-[#111111] brut-press flex items-center justify-center ${
                onProfile ? "bg-[#C4A1FF]" : "bg-white"
              }`}
              aria-label="Profile"
            >
              <User size={18} strokeWidth={2.5} />
            </Link>
            <button
              onClick={onLogout}
              data-testid="nav-logout-btn"
              className="w-10 h-10 border-2 border-[#111111] brut-press bg-white flex items-center justify-center"
              aria-label="Logout"
            >
              <LogOut size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
