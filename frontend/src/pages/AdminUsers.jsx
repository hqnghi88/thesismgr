import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Button, Form, Badge, Table, Alert, Collapse } from "react-bootstrap";

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [roleFilter, setRoleFilter] = useState("all");
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
    const [editId, setEditId] = useState(null);
    const [importing, setImporting] = useState(false);

    const token = localStorage.getItem("token");

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUsers(res.data);
        } catch (err) {
            console.error("Fetch users error:", err.response?.data || err.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/users/${editId}`, form, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/users`, form, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
            setForm({ name: "", email: "", password: "", role: "student" });
            setEditId(null);
            setShowForm(false);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.message || "Error saving user");
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setImporting(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/import-users`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
            });
            alert(`Import successful!\nCreated: ${res.data.created}\nUpdated: ${res.data.updated}\nSkipped: ${res.data.skipped}`);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.message || "Import failed");
        } finally {
            setImporting(false);
            e.target.value = ''; // Reset file input
        }
    };

    const handleDeleteByRole = async (role) => {
        if (!window.confirm(`Are you sure you want to delete ALL ${role}s? This action cannot be undone.`)) return;
        try {
            const res = await axios.delete(`${import.meta.env.VITE_API_URL}/api/users/role/${role}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            alert(res.data.message);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.message || `Error deleting ${role}s`);
        }
    };

    const handleEdit = (user) => {
        setEditId(user._id);
        setForm({ name: user.name, email: user.email, password: "", role: user.role });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (userId) => {
        if (!window.confirm("Are you sure you want to delete this user?")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchUsers();
        } catch (err) {
            alert("Error deleting user");
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter((user) =>
        roleFilter === "all" ? true : user.role === roleFilter
    );

    const getRoleBadgeVariant = (role) => {
        switch (role) {
            case 'admin': return 'danger';
            case 'professor': return 'primary';
            case 'student': return 'success';
            default: return 'secondary';
        }
    };

    return (
        <Container fluid className="py-4" style={{ marginTop: '70px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            <Container>
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                    <h2 className="mb-0 fw-bold">👥 User & Staff Management</h2>
                    <div className="d-flex gap-2 flex-wrap">
                        <Button variant="outline-danger" onClick={() => handleDeleteByRole('professor')}>
                            🗑️ Delete All Professors
                        </Button>
                        <Button variant="outline-danger" onClick={() => handleDeleteByRole('student')}>
                            🗑️ Delete All Students
                        </Button>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            style={{ display: 'none' }}
                            id="user-excel-upload"
                            onChange={handleImport}
                            disabled={importing}
                        />
                        <label htmlFor="user-excel-upload" className="mb-0">
                            <Button
                                as="span"
                                variant="success"
                                disabled={importing}
                                style={{ cursor: importing ? 'not-allowed' : 'pointer' }}
                            >
                                {importing ? "Importing..." : "📥 Import from Excel"}
                            </Button>
                        </label>
                        <Button
                            variant="primary"
                            onClick={() => {
                                setShowForm(!showForm);
                                setEditId(null);
                                setForm({ name: "", email: "", password: "", role: "student" });
                            }}
                        >
                            {showForm ? "Cancel" : "➕ Add New User"}
                        </Button>
                    </div>
                </div>

                {/* Import Info */}
                <Alert variant="info" className="mb-4">
                    <Alert.Heading className="h6">📥 Excel Import Format</Alert.Heading>
                    <small>
                        Your Excel file should have columns: <strong>Title</strong>, <strong>Name</strong>, <strong>Email</strong>, Code, Short.
                        <br />
                        All imported users will be created as <Badge bg="primary">Professors</Badge> with default password: <code>password123</code>
                        <br />
                        Existing users (matched by email) will be updated with new names.
                    </small>
                </Alert>

                {/* Form Card */}
                <Collapse in={showForm}>
                    <div>
                        <Card className="border-0 shadow-sm mb-4">
                            <Card.Body>
                                <h5 className="mb-3 fw-bold">{editId ? "✏️ Edit User" : "➕ Create New User"}</h5>
                                <Form onSubmit={handleSubmit}>
                                    <Row>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label className="fw-semibold">Full Name</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="Enter full name"
                                                    value={form.name}
                                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label className="fw-semibold">Email Address</Form.Label>
                                                <Form.Control
                                                    type="email"
                                                    placeholder="Enter email"
                                                    value={form.email}
                                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        {!editId && (
                                            <Col md={6} className="mb-3">
                                                <Form.Group>
                                                    <Form.Label className="fw-semibold">Password</Form.Label>
                                                    <Form.Control
                                                        type="password"
                                                        placeholder="Enter password"
                                                        value={form.password}
                                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                                        required
                                                    />
                                                </Form.Group>
                                            </Col>
                                        )}
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label className="fw-semibold">Role</Form.Label>
                                                <Form.Select
                                                    value={form.role}
                                                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                                                    required
                                                >
                                                    <option value="student">Student</option>
                                                    <option value="professor">Professor</option>
                                                    <option value="admin">Admin</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col xs={12}>
                                            <Button variant="primary" type="submit" className="w-100">
                                                {editId ? "Update User" : "Save User"}
                                            </Button>
                                        </Col>
                                    </Row>
                                </Form>
                            </Card.Body>
                        </Card>
                    </div>
                </Collapse>

                {/* Filter */}
                <Card className="border-0 shadow-sm mb-4">
                    <Card.Body>
                        <Row className="align-items-center">
                            <Col xs={12} sm="auto">
                                <Form.Label className="mb-2 mb-sm-0 fw-semibold">Filter View:</Form.Label>
                            </Col>
                            <Col xs={12} sm="auto">
                                <Form.Select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    style={{ width: '200px' }}
                                >
                                    <option value="all">All Users</option>
                                    <option value="professor">Professors</option>
                                    <option value="student">Students</option>
                                    <option value="admin">Admins</option>
                                </Form.Select>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Users Table - Desktop */}
                <Card className="border-0 shadow-sm d-none d-md-block">
                    <Table responsive hover className="mb-0">
                        <thead className="table-primary">
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user._id}>
                                    <td className="align-middle">{user.name}</td>
                                    <td className="align-middle">{user.email}</td>
                                    <td className="align-middle">
                                        <Badge bg={getRoleBadgeVariant(user.role)} className="text-capitalize">
                                            {user.role}
                                        </Badge>
                                    </td>
                                    <td className="align-middle text-center">
                                        <Button
                                            variant="outline-warning"
                                            size="sm"
                                            onClick={() => handleEdit(user)}
                                            className="me-2"
                                        >
                                            ✏️ Edit
                                        </Button>
                                        <Button
                                            variant="outline-danger"
                                            size="sm"
                                            onClick={() => handleDelete(user._id)}
                                        >
                                            🗑️ Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center text-muted py-4">
                                        No users found for this filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </Card>

                {/* Users Cards - Mobile */}
                <div className="d-md-none">
                    <Row className="g-3">
                        {filteredUsers.map((user) => (
                            <Col xs={12} key={user._id}>
                                <Card className="border-0 shadow-sm">
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <h6 className="mb-0 fw-bold">{user.name}</h6>
                                            <Badge bg={getRoleBadgeVariant(user.role)} className="text-capitalize">
                                                {user.role}
                                            </Badge>
                                        </div>
                                        <p className="text-muted small mb-3">{user.email}</p>
                                        <div className="d-flex gap-2">
                                            <Button
                                                variant="outline-warning"
                                                size="sm"
                                                onClick={() => handleEdit(user)}
                                                className="flex-fill"
                                            >
                                                ✏️ Edit
                                            </Button>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => handleDelete(user._id)}
                                                className="flex-fill"
                                            >
                                                🗑️ Delete
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                    {filteredUsers.length === 0 && (
                        <Alert variant="info" className="text-center">
                            No users found for this filter.
                        </Alert>
                    )}
                </div>
            </Container>
        </Container>
    );
};

export default AdminUsers;
