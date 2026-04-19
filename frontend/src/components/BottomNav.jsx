import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Compass, PlusSquare, Bookmark, User } from "lucide-react";

export default function BottomNav({ onCreate }) {
  const itemBase = "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-black uppercase tracking-[0.18em]";
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 bg-[#FFFDF5] border-t-2 border-[#111111] z-40 safe-pb"
    >
      <div className="max-w-2xl mx-auto flex items-stretch">
        <NavLink
          to="/feed"
          end
          data-testid="nav-feed"
          className={({ isActive }) =>
            `${itemBase} ${isActive ? "text-[#FF5E5E]" : "text-[#111111]"}`
          }
        >
          {({ isActive }) => (
            <>
              <Home size={22} strokeWidth={isActive ? 3 : 2.25} fill={isActive ? "currentColor" : "none"} />
              <span>Feed</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/explore"
          data-testid="nav-explore"
          className={({ isActive }) =>
            `${itemBase} ${isActive ? "text-[#FF5E5E]" : "text-[#111111]"}`
          }
        >
          {({ isActive }) => (
            <>
              <Compass size={22} strokeWidth={isActive ? 3 : 2.25} />
              <span>Explore</span>
            </>
          )}
        </NavLink>

        <button
          type="button"
          onClick={onCreate}
          data-testid="nav-create-btn"
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#111111]"
        >
          <div className="w-10 h-10 -my-1 bg-[#FF5E5E] border-2 border-[#111111] brut-shadow-sm flex items-center justify-center text-white">
            <PlusSquare size={20} strokeWidth={2.75} />
          </div>
          <span>Post</span>
        </button>

        <NavLink
          to="/saved"
          data-testid="nav-saved"
          className={({ isActive }) =>
            `${itemBase} ${isActive ? "text-[#FF5E5E]" : "text-[#111111]"}`
          }
        >
          {({ isActive }) => (
            <>
              <Bookmark size={22} strokeWidth={isActive ? 3 : 2.25} fill={isActive ? "currentColor" : "none"} />
              <span>Saved</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/profile"
          data-testid="nav-profile"
          className={({ isActive }) =>
            `${itemBase} ${isActive ? "text-[#FF5E5E]" : "text-[#111111]"}`
          }
        >
          {({ isActive }) => (
            <>
              <User size={22} strokeWidth={isActive ? 3 : 2.25} />
              <span>Me</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
