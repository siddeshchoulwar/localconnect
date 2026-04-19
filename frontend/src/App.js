import React from "react";
import "@/App.css";
import "leaflet/dist/leaflet.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Feed from "@/pages/Feed";
import Profile from "@/pages/Profile";
import EditProfile from "@/pages/EditProfile";
import Explore from "@/pages/Explore";
import Saved from "@/pages/Saved";
import Shops from "@/pages/Shops";
import BusinessDetail from "@/pages/BusinessDetail";
import Events from "@/pages/Events";
import Notifications from "@/pages/Notifications";
import { Toaster } from "sonner";

// Redirect /profile/:id to /shop/:id if the user is a business (handled in components instead)

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/shops" element={<ProtectedRoute><Shops /></ProtectedRoute>} />
            <Route path="/shop/:userId" element={<ProtectedRoute><BusinessDetail /></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
            <Route path="/saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            <Route path="/" element={<Navigate to="/feed" replace />} />
            <Route path="*" element={<Navigate to="/feed" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-center"
          offset={90}
          toastOptions={{
            style: {
              border: "2px solid #111111",
              borderRadius: 0,
              boxShadow: "4px 4px 0 0 #111111",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              background: "#FFFDF5",
              color: "#111111",
            },
          }}
        />
      </AuthProvider>
    </div>
  );
}
