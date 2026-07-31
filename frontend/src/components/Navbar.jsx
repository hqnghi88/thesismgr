import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar, Nav, Container, Button, Dropdown } from "react-bootstrap";
import { useSemester } from "../context/SemesterContext";

const NavigationBar = () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const navigate = useNavigate();
  const { activeSemester, semesters, switchSemester, loading } = useSemester();

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
    localStorage.removeItem("activeSemesterId");
    navigate("/login");
  };

  const handleSwitchSemester = async (semesterId) => {
    try {
      await switchSemester(semesterId);
    } catch (err) {
      console.error("Failed to switch semester");
    }
  };

  return (
    <Navbar bg="primary" variant="dark" expand="lg" fixed="top" className="shadow-sm">
      <Container>
        <Navbar.Brand onClick={handleLogoClick} style={{ cursor: "pointer", fontWeight: "600" }}>
          SE Thesis
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            {token ? (
              <>
                {activeSemester && (
                  <Dropdown align="end" className="me-2">
                    <Dropdown.Toggle variant="outline-light" size="sm" id="semester-dropdown">
                      {activeSemester.displayName}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {semesters.map(s => (
                        <Dropdown.Item
                          key={s._id}
                          active={s._id === activeSemester?._id}
                          onClick={() => handleSwitchSemester(s._id)}
                        >
                          {s.displayName}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                )}
                <Nav.Link as={Link} to="/" className="text-white">Dashboard</Nav.Link>
                <Nav.Link as={Link} to="/theses" className="text-white">Theses</Nav.Link>
                <Nav.Link as={Link} to="/planning" className="text-white">Planning</Nav.Link>
                {user.role === 'admin' && (
                  <>
                    <Nav.Link as={Link} to="/admin/users" className="text-white">Users</Nav.Link>
                    <Nav.Link as={Link} to="/admin/theses" className="text-white">All Theses</Nav.Link>
                    <Nav.Link as={Link} to="/admin/semesters" className="text-white">Semesters</Nav.Link>
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
