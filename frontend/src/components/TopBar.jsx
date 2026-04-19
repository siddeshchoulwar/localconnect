import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, MapPin, LogOut, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/Avatar";
import { useDebounce } from "@/hooks/useDebounce";

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(q, 280);

  useEffect(() => {
    if (!debounced.trim()) {
      setResults({ users: [], posts: [] });
      return;
    }
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/search`, { params: { q: debounced.trim() } });
        if (!cancel) setResults(data);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [debounced]);

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  const closeSearch = () => {
    setOpen(false);
    setQ("");
  };

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-40 bg-[#FFFDF5]/95 backdrop-blur border-b-2 border-[#111111]"
    >
      <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
        <Link to="/feed" className="flex items-center gap-2 shrink-0" data-testid="logo-link">
          <div className="w-9 h-9 bg-[#FF5E5E] border-2 border-[#111111] brut-shadow-sm flex items-center justify-center">
            <MapPin size={18} strokeWidth={2.75} className="text-white" />
          </div>
          <span className="font-heading font-black text-xl tracking-tighter hidden sm:block">local.</span>
        </Link>

        <div className="flex-1 relative">
          <div className="relative">
            <Search size={16} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
            <input
              data-testid="search-input"
              type="text"
              placeholder="Search neighbours, areas, posts…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              className="w-full bg-white border-2 border-[#111111] pl-9 pr-9 py-2.5 text-sm font-medium placeholder-[#8A8A8A] focus:outline-none focus:bg-[#FFFDF5]"
            />
            {q && (
              <button
                onClick={closeSearch}
                data-testid="search-clear"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center border-2 border-[#111111] bg-white"
                aria-label="Clear"
              >
                <X size={12} strokeWidth={3} />
              </button>
            )}
          </div>

          {open && q.trim() && (
            <div
              data-testid="search-results"
              className="absolute left-0 right-0 top-[calc(100%+8px)] bg-white border-2 border-[#111111] brut-shadow max-h-[70vh] overflow-y-auto z-50"
            >
              {loading && (
                <div className="p-4 text-xs font-bold text-[#8A8A8A]">Searching…</div>
              )}
              {!loading && results.users.length === 0 && results.posts.length === 0 && (
                <div className="p-4 text-xs font-bold text-[#8A8A8A]">No results for "{q}"</div>
              )}
              {results.users.length > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1 text-[10px] font-black tracking-[0.25em] uppercase text-[#8A8A8A]">Neighbours</div>
                  {results.users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { navigate(`/profile/${u.id}`); closeSearch(); }}
                      className="w-full text-left flex items-center gap-3 p-3 hover:bg-[#FFFDF5] border-t border-[#111111]/10"
                      data-testid={`search-user-${u.id}`}
                    >
                      <Avatar name={u.name} path={u.avatar_path} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="font-heading font-black text-sm truncate">{u.name}</div>
                        <div className="text-[11px] text-[#8A8A8A] font-semibold flex items-center gap-1">
                          <MapPin size={10} strokeWidth={2.75} /> {u.area}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.posts.length > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1 text-[10px] font-black tracking-[0.25em] uppercase text-[#8A8A8A] border-t-2 border-[#111111]">Posts</div>
                  {results.posts.slice(0, 8).map((p) => (
                    <div key={p.id} className="p-3 border-t border-[#111111]/10 text-sm">
                      <div className="text-[11px] font-bold text-[#8A8A8A] mb-1">{p.user_name} · {p.area}</div>
                      <div className="line-clamp-2 text-[13px] font-medium">{p.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          data-testid="logout-btn"
          title="Log out"
          className="w-10 h-10 border-2 border-[#111111] brut-press bg-white flex items-center justify-center shrink-0"
        >
          <LogOut size={16} strokeWidth={2.5} />
        </button>
      </div>
    </header>
  );
}
