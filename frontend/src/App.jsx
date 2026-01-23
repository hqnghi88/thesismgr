import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import { Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";

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
      <Navbar />
      <div style={{ paddingTop: "70px" }}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                {" "}
                <Dashboard />{" "}
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginRedirect />} />
          <Route path="/register" element={<RegisterRedirect />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
