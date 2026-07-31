import React, { useState } from "react";
import { Container, Card, Button, Form, Badge, Alert, ListGroup } from "react-bootstrap";
import { useNotification } from "../context/NotificationContext";
import { useSemester } from "../context/SemesterContext";

const AdminSemesters = () => {
    const { notify, confirm } = useNotification();
    const { semesters, activeSemester, switchSemester, createSemester, deleteSemester } = useSemester();
    const [newName, setNewName] = useState("");
    const [newDisplayName, setNewDisplayName] = useState("");
    const [creating, setCreating] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName || !newDisplayName) {
            notify("Please fill in both fields");
            return;
        }
        setCreating(true);
        try {
            await createSemester(newName, newDisplayName);
            setNewName("");
            setNewDisplayName("");
            notify("Semester created successfully");
        } catch (err) {
            notify(err.response?.data?.message || "Failed to create semester");
        } finally {
            setCreating(false);
        }
    };

    const handleActivate = async (id) => {
        try {
            await switchSemester(id);
            notify("Semester activated");
        } catch (err) {
            notify("Failed to activate semester");
        }
    };

    const handleDelete = async (id, name) => {
        if (!(await confirm(`Delete semester "${name}"? This will NOT delete the theses/schedules inside it.`))) return;
        try {
            await deleteSemester(id);
            notify("Semester deleted");
        } catch (err) {
            notify(err.response?.data?.message || "Failed to delete semester");
        }
    };

    return (
        <Container fluid className="py-4" style={{ marginTop: '70px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            <Container>
                <h2 className="mb-4 fw-bold">Semesters</h2>

                <Card className="border-0 shadow-sm mb-4">
                    <Card.Body>
                        <h5 className="mb-3 fw-bold">Create New Semester</h5>
                        <Form onSubmit={handleCreate}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-semibold">Semester Code</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g. HK3-2025-2026"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    required
                                />
                                <Form.Text className="text-muted">Unique code for the semester</Form.Text>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-semibold">Display Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g. Học kỳ 3 - Năm học 2025-2026"
                                    value={newDisplayName}
                                    onChange={(e) => setNewDisplayName(e.target.value)}
                                    required
                                />
                                <Form.Text className="text-muted">Human-readable name shown in the UI</Form.Text>
                            </Form.Group>
                            <Button variant="success" type="submit" disabled={creating}>
                                {creating ? "Creating..." : "Create Semester"}
                            </Button>
                        </Form>
                    </Card.Body>
                </Card>

                <Card className="border-0 shadow-sm">
                    <Card.Body>
                        <h5 className="mb-3 fw-bold">All Semesters</h5>
                        <ListGroup variant="flush">
                            {semesters.map(s => (
                                <ListGroup.Item key={s._id} className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <span className="fw-bold">{s.displayName}</span>
                                        <span className="text-muted ms-2">({s.name})</span>
                                        {s.isActive && <Badge bg="success" className="ms-2">Active</Badge>}
                                    </div>
                                    <div className="d-flex gap-2">
                                        {!s.isActive && (
                                            <Button variant="outline-success" size="sm" onClick={() => handleActivate(s._id)}>
                                                Activate
                                            </Button>
                                        )}
                                        {!s.isActive && (
                                            <Button variant="outline-danger" size="sm" onClick={() => handleDelete(s._id, s.name)}>
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                </ListGroup.Item>
                            ))}
                            {semesters.length === 0 && (
                                <ListGroup.Item className="text-muted text-center py-4">
                                    No semesters created yet
                                </ListGroup.Item>
                            )}
                        </ListGroup>
                    </Card.Body>
                </Card>
            </Container>
        </Container>
    );
};

export default AdminSemesters;
