import { useState } from "react"; // importing Hook: useState
import { Link, useNavigate } from "react-router-dom"; // Hooks are special functions that let you use React features inside functional components.
import "./Auth.css";

function Register() {
  // STEP 1: Create state variables;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const navigate = useNavigate();

  // SETP 2: Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent page reload;
    console.log("Submitted:", { name, email, password, role });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (res.ok) {
        console.log("User Registered:", data);
        alert("Registration Successfull!");
        navigate("/login");
      } else {
        console.error("Registeration error:", data.message);
        alert("Error:" + data.message);
      }
    } catch (err) {
      console.error("Request failed:", err);
      alert("Something went wrong");
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Register</h2>

        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div style={{ margin: "10px 0", textAlign: "left" }}>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem", color: "#666" }}>Register as:</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", background: "white" }}
          >
            <option value="student">Student</option>
            <option value="professor">Professor / Supervisor</option>
          </select>
        </div>

        <button type="submit">Register</button>

        <p className="switch-link">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </form>
    </div>

  );
}

export default Register;
