import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar, Nav, Container, Button } from "react-bootstrap";

const NavigationBar = () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const navigate = useNavigate();

  const handleLogoClick = () => {
    if (token) {
      navigate("/");
    } else {
      navigate("/login");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <Navbar bg="primary" variant="dark" expand="lg" fixed="top" className="shadow-sm">
      <Container>
        <Navbar.Brand onClick={handleLogoClick} style={{ cursor: "pointer", fontWeight: "600" }}>
          🎓 ThesisMgr
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            {token ? (
              <>
                <Nav.Link as={Link} to="/" className="text-white">Dashboard</Nav.Link>
                <Nav.Link as={Link} to="/theses" className="text-white">Theses</Nav.Link>
                <Nav.Link as={Link} to="/planning" className="text-white">Planning</Nav.Link>
                {user.role === 'admin' && (
                  <>
                    <Nav.Link as={Link} to="/admin/users" className="text-white">Users</Nav.Link>
                    <Nav.Link as={Link} to="/admin/theses" className="text-white">All Theses</Nav.Link>
                  </>
                )}
                <Button variant="outline-light" size="sm" onClick={handleLogout} className="ms-2">
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/login" className="text-white">Login</Nav.Link>
                <Nav.Link as={Link} to="/register" className="text-white">Register</Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavigationBar;
