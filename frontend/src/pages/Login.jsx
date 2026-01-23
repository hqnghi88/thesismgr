import React from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";

function Login() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const navigate = useNavigate(); // optional redirect after login

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value }); //   // We use the spread operator ...formData to keep the other field unchanged
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Login Successful!");
        // Save token to local Storage
        localStorage.setItem("token", data.token);
        navigate("/"); // redirect to dashboard
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-box">
        <div className="auth-intro">
          <h1>Welcome to TaskZen 📝</h1>
          <p>
            Your personal productivity companion to manage tasks efficiently and
            stay organized.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Login</h2>

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <button type="submit">Login</button>
          <p className="switch-link">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
