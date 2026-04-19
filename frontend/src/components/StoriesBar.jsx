import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "@/components/Avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Plus } from "lucide-react";

export default function StoriesBar({ onCreate }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await api.get("/stories");
        if (!cancel) setItems(data.items || []);
      } catch {}
    })();
    return () => { cancel = true; };
  }, [user?.area]);

  return (
    <div
      data-testid="stories-bar"
      className="bg-white border-2 border-[#111111] brut-shadow mx-4 sm:mx-6 mt-4 py-3 overflow-hidden"
    >
      <div className="flex gap-3 overflow-x-auto px-3 pb-1 no-scrollbar">
        {/* You (create) */}
        <button
          onClick={onCreate}
          data-testid="stories-create-btn"
          className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]"
        >
          <div className="relative">
            <Avatar name={user?.name || "You"} path={user?.avatar_path} size={56} ring={false} />
            <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-[#FF5E5E] border-2 border-[#111111] flex items-center justify-center rounded-full">
              <Plus size={14} strokeWidth={3} className="text-white" />
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider">You</span>
        </button>

        {items.map((u) => (
          <button
            key={u.id}
            onClick={() => navigate(`/profile/${u.id}`)}
            data-testid={`stories-user-${u.id}`}
            className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]"
          >
            <Avatar name={u.name} path={u.avatar_path} size={56} ring active={u.active} />
            <span className="text-[10px] font-black uppercase tracking-wider truncate max-w-full">
              {u.name.split(" ")[0]}
            </span>
          </button>
        ))}

        {items.length === 0 && (
          <div className="flex-1 text-xs font-bold text-[#8A8A8A] px-2 flex items-center">
            No neighbours yet — invite a friend to your area!
          </div>
        )}
      </div>
    </div>
  );
}
