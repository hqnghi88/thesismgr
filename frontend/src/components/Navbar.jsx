import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

const Navbar = () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const navigate = useNavigate();

  const handleLogoClick = () => {
    if (token) {
      navigate("/"); // Go to Dashboard if logged in
    } else {
      navigate("/login"); // Go to Login if not logged in
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div
        className="navbar-title"
        onClick={handleLogoClick}
        style={{ cursor: "pointer", fontWeight: "bold", fontSize: "1.3rem" }}
      >
        🎓 ThesisMgr
      </div>

      <ul className="navbar-links">
        {token ? (
          <>
            <li>
              <Link to="/">Theses</Link>
            </li>
            <li>
              <Link to="/planning">Planning</Link>
            </li>
            {user.role === 'admin' && (
              <>
                <li>
                  <Link to="/admin/users">Users</Link>
                </li>
                <li>
                  <Link to="/admin/theses">All Theses</Link>
                </li>
              </>
            )}
            <li>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </li>
          </>


        ) : (
          <>
            <li>
              <Link to="/login">Login</Link>
            </li>
            <li>
              <Link to="/register">Register</Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
