import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Button, Form, Badge, Alert } from "react-bootstrap";

const AdminTheses = () => {
    const [theses, setTheses] = useState([]);
    const [professors, setProfessors] = useState([]);
    const [importing, setImporting] = useState(false);
    const token = localStorage.getItem("token");

    const fetchData = async () => {
        try {
            const [thesisRes, profRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/admin/theses`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/professors`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setTheses(thesisRes.data);
            setProfessors(profRes.data);
        } catch (err) {
            console.error("Fetch data error:", err.response?.data || err.message);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setImporting(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/import-excel`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
            });
            alert(res.data.message + ": " + res.data.count + " records created.");
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || "Import failed");
        } finally {
            setImporting(false);
        }
    };

    const handleUpdate = async (thesisId, updates) => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/theses/${thesisId}`,
                updates,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchData();
        } catch (err) {
            alert("Error updating thesis");
        }
    };

    const handleDelete = async (thesisId) => {
        if (!window.confirm("Are you sure you want to delete this thesis?")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/theses/${thesisId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (err) {
            alert("Error deleting thesis");
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm("Are you sure you want to delete ALL theses? This action cannot be undone.")) return;
        try {
            const res = await axios.delete(`${import.meta.env.VITE_API_URL}/api/admin/theses/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.message);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || "Error deleting all theses");
        }
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'submitted': return 'secondary';
            case 'under_review': return 'warning';
            case 'approved': return 'success';
            case 'scheduled': return 'info';
            case 'completed': return 'primary';
            default: return 'secondary';
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <Container fluid className="py-4" style={{ marginTop: '70px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            <Container>
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                    <h2 className="mb-0 fw-bold">🎓 All Theses (Admin Console)</h2>
                    <div className="d-flex gap-2 flex-wrap">
                        <Button variant="outline-danger" onClick={handleDeleteAll}>
                            🗑️ Delete All Theses
                        </Button>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            style={{ display: 'none' }}
                            id="excel-upload"
                            onChange={handleImport}
                            disabled={importing}
                        />
                        <label htmlFor="excel-upload" className="mb-0">
                            <Button
                                as="span"
                                variant="success"
                                disabled={importing}
                                style={{ cursor: importing ? 'not-allowed' : 'pointer' }}
                            >
                                {importing ? "Importing..." : "📥 Import from Excel"}
                            </Button>
                        </label>
                    </div>
                </div>

                <Row className="g-4">
                    {theses.map((thesis) => (
                        <Col key={thesis._id} xs={12}>
                            <Card className="border-0 shadow-sm">
                                <Card.Body>
                                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start mb-3 gap-2">
                                        <h5 className="mb-0 fw-bold flex-grow-1">🎓 {thesis.title}</h5>
                                        <Badge bg={getStatusVariant(thesis.status)} className="text-nowrap">
                                            {thesis.status.replace('_', ' ')}
                                        </Badge>
                                    </div>

                                    <p className="text-muted mb-3">{thesis.abstract}</p>

                                    <div className="small text-muted mb-3">
                                        <div className="mb-1">
                                            <strong>Student:</strong> {thesis.student?.name} ({thesis.student?.email})
                                        </div>
                                        <div>
                                            <strong>Current Supervisor:</strong> {thesis.supervisor?.name || "Not assigned"}
                                        </div>
                                    </div>

                                    <Row className="g-3 align-items-end">
                                        <Col xs={12} sm={6} md={4}>
                                            <Form.Group>
                                                <Form.Label className="small fw-semibold mb-1">Update Status</Form.Label>
                                                <Form.Select
                                                    size="sm"
                                                    value={thesis.status}
                                                    onChange={(e) => handleUpdate(thesis._id, { status: e.target.value })}
                                                >
                                                    <option value="submitted">Submitted</option>
                                                    <option value="under_review">Under Review</option>
                                                    <option value="approved">Approved</option>
                                                    <option value="scheduled">Scheduled</option>
                                                    <option value="completed">Completed</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>

                                        <Col xs={12} sm={6} md={4}>
                                            <Form.Group>
                                                <Form.Label className="small fw-semibold mb-1">Reassign Supervisor</Form.Label>
                                                <Form.Select
                                                    size="sm"
                                                    value={thesis.supervisor?._id || ""}
                                                    onChange={(e) => handleUpdate(thesis._id, { supervisor: e.target.value })}
                                                >
                                                    <option value="">Select Professor</option>
                                                    {professors.map(p => (
                                                        <option key={p._id} value={p._id}>{p.name}</option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>

                                        <Col xs={12} md={4} className="d-flex justify-content-md-end">
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() => handleDelete(thesis._id)}
                                                className="w-100 w-md-auto"
                                            >
                                                🗑️ Delete
                                            </Button>
                                        </Col>
                                    </Row>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>

                {theses.length === 0 && (
                    <Alert variant="info" className="text-center mt-4">
                        No theses submitted yet. Import data from Excel to get started!
                    </Alert>
                )}
            </Container>
        </Container>
    );
};

export default AdminTheses;
