import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Form, Button, Badge, Alert } from "react-bootstrap";
import { useNotification } from "../context/NotificationContext";

const Theses = () => {
    const { notify, confirm } = useNotification();
    const [theses, setTheses] = useState([]);
    const [form, setForm] = useState({ title: "", abstract: "", supervisor: "" });
    const [editingId, setEditingId] = useState(null);
    const [professors, setProfessors] = useState([]);
    const token = localStorage.getItem("token");

    const fetchTheses = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/theses`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setTheses(res.data);
        } catch (err) {
            console.error("Fetch error:", err.response?.data || err.message);
        }
    };

    const fetchProfessors = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/professors`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setProfessors(res.data);
        } catch (err) {
            console.error("Fetch profs error:", err.response?.data || err.message);
        }
    };

    useEffect(() => {
        fetchTheses();
        fetchProfessors();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/theses/${editingId}`, form, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setEditingId(null);
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/theses`, form, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
            setForm({ title: "", abstract: "", supervisor: "" });
            fetchTheses();
        } catch (err) {
            console.error("error:", err.response?.data || err.message);
        }
    };

    const handleEdit = (thesis) => {
        setEditingId(thesis._id);
        setForm({
            title: thesis.title,
            abstract: thesis.abstract,
            supervisor: thesis.supervisor._id
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setForm({ title: "", abstract: "", supervisor: "" });
    };

    const handleDelete = async (thesisId) => {
        if (!(await confirm("Are you sure you want to delete this thesis?"))) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/theses/${thesisId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTheses();
        } catch (err) {
            notify("Error deleting thesis");
        }
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'pending': return 'warning';
            case 'approved': return 'success';
            case 'scheduled': return 'info';
            default: return 'secondary';
        }
    };

    return (
        <Container fluid className="py-4" style={{ marginTop: '70px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            <Container>
                <h2 className="mb-4 fw-bold">{editingId ? "✏️ Edit Thesis" : "📝 Thesis Management"}</h2>

                {/* Form Card */}
                <Card className="border-0 shadow-sm mb-4">
                    <Card.Body>
                        <Form onSubmit={handleSubmit}>
                            <Row>
                                <Col md={12} className="mb-3">
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Thesis Title</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="Enter thesis title"
                                            value={form.title}
                                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={12} className="mb-3">
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Abstract</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={3}
                                            placeholder="Enter abstract"
                                            value={form.abstract}
                                            onChange={(e) => setForm({ ...form, abstract: e.target.value })}
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={12} className="mb-3">
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Supervisor</Form.Label>
                                        <Form.Select
                                            value={form.supervisor}
                                            onChange={(e) => setForm({ ...form, supervisor: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Supervisor</option>
                                            {professors.map(prof => (
                                                <option key={prof._id} value={prof._id}>{prof.name}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={12}>
                                    <div className="d-flex gap-2">
                                        <Button variant="primary" type="submit">
                                            {editingId ? "Update Thesis" : "Submit Thesis"}
                                        </Button>
                                        {editingId && (
                                            <Button variant="secondary" type="button" onClick={handleCancelEdit}>
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                        </Form>
                    </Card.Body>
                </Card>

                {/* Theses List */}
                <Row className="g-4">
                    {theses.map((thesis) => (
                        <Col key={thesis._id} lg={6} xl={4}>
                            <Card className="border-0 shadow-sm h-100">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <h5 className="mb-0 fw-bold">🎓 {thesis.title}</h5>
                                        <Badge bg={getStatusVariant(thesis.status)}>
                                            {thesis.status.replace('_', ' ')}
                                        </Badge>
                                    </div>
                                    <p className="text-muted small mb-3">{thesis.abstract}</p>
                                    <div className="small text-muted mb-3">
                                        <div><strong>Student:</strong> {thesis.student?.name}</div>
                                        <div><strong>Supervisor:</strong> {thesis.supervisor?.name}</div>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <Button variant="outline-primary" size="sm" onClick={() => handleEdit(thesis)}>
                                            ✏️ Edit
                                        </Button>
                                        <Button variant="outline-danger" size="sm" onClick={() => handleDelete(thesis._id)}>
                                            🗑️ Delete
                                        </Button>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>

                {theses.length === 0 && (
                    <Alert variant="info" className="text-center">
                        No theses found. Create your first thesis above!
                    </Alert>
                )}
            </Container>
        </Container>
    );
};

export default Theses;
