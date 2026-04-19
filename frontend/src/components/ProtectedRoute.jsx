import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFDF5]">
        <Loader2 size={32} strokeWidth={2.5} className="animate-spin text-[#FF5E5E]" />
      </div>
    );
  }
  if (user === false) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
