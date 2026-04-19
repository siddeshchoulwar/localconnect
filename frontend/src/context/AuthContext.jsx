import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("lc_token");
    if (!token) {
      setUser(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      localStorage.removeItem("lc_token");
      setUser(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("lc_token", data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const signup = async (payload) => {
    try {
      const { data } = await api.post("/auth/signup", payload);
      localStorage.setItem("lc_token", data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const logout = () => {
    localStorage.removeItem("lc_token");
    setUser(false);
  };

  const updateLocation = async (lat, lng) => {
    try {
      const { data } = await api.post("/users/me/location", { lat, lng });
      setUser(data);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, signup, logout, refresh: fetchMe, updateLocation }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
