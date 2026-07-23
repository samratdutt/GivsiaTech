import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("givsia_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem("givsia_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("givsia_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (payload) => {
    const res = await api.post("/auth/register", payload);
    localStorage.setItem("givsia_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const registerAdmin = async (payload) => {
    const res = await api.post("/auth/register-admin", payload);
    localStorage.setItem("givsia_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const registerService = async (payload) => {
    const res = await api.post("/auth/register-service", payload);
    localStorage.setItem("givsia_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const loginWithGoogle = async (idToken) => {
    const res = await api.post("/auth/google-login", { idToken });
    localStorage.setItem("givsia_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const registerWithGoogle = async (payload) => {
    const res = await api.post("/auth/google-register", payload);
    localStorage.setItem("givsia_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const sendOtp = async (phone) => {
    const res = await api.post("/auth/send-otp", { phone });
    return res.data;
  };

  const verifyOtp = async (phone, code) => {
    const res = await api.post("/auth/verify-otp", { phone, code });
    return res.data;
  };

  // Neither of these logs the user in — forgot-password only sends a link,
  // and reset-password intentionally doesn't auto-authenticate afterward
  // (the user logs in fresh with their new password, same as any other
  // password change).
  const forgotPassword = async (email) => {
    const res = await api.post("/auth/forgot-password", { email });
    return res.data;
  };

  const resetPassword = async (token, newPassword, confirmPassword) => {
    const res = await api.post("/auth/reset-password", { token, newPassword, confirmPassword });
    return res.data;
  };

  const updateProfile = async (payload) => {
    const res = await api.patch("/users/me", payload);
    setUser(res.data.user);
    return res.data.user;
  };

  // Tells the backend to invalidate this token server-side (bumps
  // tokenVersion — see middleware/auth.js) before forgetting it locally, so
  // a copied/leaked token can't keep working after the real user logs out.
  // Local state is always cleared regardless of whether the API call
  // succeeds — a network hiccup or an already-expired token should never
  // leave the logout button looking like it didn't work.
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // already logged out / token invalid / offline — nothing more to do server-side
    }
    localStorage.removeItem("givsia_token");
    setUser(null);
  };

  const deleteAccount = async (currentPassword) => {
    await api.delete("/users/me", { data: { currentPassword } });
    localStorage.removeItem("givsia_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        registerAdmin,
        registerService,
        loginWithGoogle,
        registerWithGoogle,
        sendOtp,
        verifyOtp,
        forgotPassword,
        resetPassword,
        updateProfile,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
