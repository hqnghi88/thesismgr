import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Theses from "./pages/Theses";
import Planning from "./pages/Planning";
import AdminUsers from "./pages/AdminUsers";
import AdminTheses from "./pages/AdminTheses";
import AdminSemesters from "./pages/AdminSemesters";
import ProtectedRoute from "./components/ProtectedRoute";
import { Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import { NotificationProvider } from "./context/NotificationContext";
import { SemesterProvider } from "./context/SemesterContext";

const LoginRedirect = () => {
  const token = localStorage.getItem("token");
  return token ? <Navigate to="/" /> : <Login />;
};

const RegisterRedirect = () => {
  const token = localStorage.getItem("token");
  return token ? <Navigate to="/" /> : <Register />;
};

function App() {
  return (
    <Router>
      <NotificationProvider>
        <SemesterProvider>
          <Navbar />
          <div style={{ paddingTop: "70px" }}>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/theses"
                element={
                  <ProtectedRoute>
                    <Theses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/planning"
                element={
                  <ProtectedRoute>
                    <Planning />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute>
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/theses"
                element={
                  <ProtectedRoute>
                    <AdminTheses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/semesters"
                element={
                  <ProtectedRoute>
                    <AdminSemesters />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LoginRedirect />} />
              <Route path="/register" element={<RegisterRedirect />} />
            </Routes>
          </div>
        </SemesterProvider>
      </NotificationProvider>
    </Router>
  );
}

export default App;
