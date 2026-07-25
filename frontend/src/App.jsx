import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import AmbientField from "./components/AmbientField.jsx";
import GiviChat from "./components/GiviChat.jsx";
import CookieConsent from "./components/CookieConsent.jsx";
import VisitorTracker from "./components/VisitorTracker.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Profile from "./pages/Profile.jsx";
import AdminDashboard from "./pages/dashboards/AdminDashboard.jsx";
import ClientDashboard from "./pages/dashboards/ClientDashboard.jsx";
import ServiceDashboard from "./pages/dashboards/ServiceDashboard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  const [loading, setLoading] = useState(true);

  return (
    <>
      {loading && <LoadingScreen onDone={() => setLoading(false)} />}
      <AmbientField />
      <div style={{ position: "relative", zIndex: 1 }}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={["admin", "client", "service"]}>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/client"
            element={
              <ProtectedRoute allowedRoles={["admin", "client"]}>
                <ClientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/service"
            element={
              <ProtectedRoute allowedRoles={["admin", "service"]}>
                <ServiceDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
        <Footer />
      </div>
      <GiviChat />
      <CookieConsent />
      <VisitorTracker />
    </>
  );
}
