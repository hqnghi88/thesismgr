import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Button, Modal, Form, Badge, ListGroup, Alert, ButtonGroup, Table } from "react-bootstrap";

const Planning = () => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [professors, setProfessors] = useState([]);
    const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'timetable'
    const [editForm, setEditForm] = useState({
        principal: '',
        examinator: '',
        supervisor: '',
        startTime: '',
        endTime: '',
        room: ''
    });
    const [error, setError] = useState('');
    const token = localStorage.getItem("token");

    const fetchSchedules = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/schedules`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSchedules(res.data);
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
            console.error("Fetch professors error:", err.response?.data || err.message);
        }
    };

    const handleEdit = (schedule) => {
        setEditingSchedule(schedule._id);
        setEditForm({
            principal: schedule.principal._id,
            examinator: schedule.examinator._id,
            supervisor: schedule.supervisor._id,
            startTime: new Date(schedule.startTime).toISOString().slice(0, 16),
            endTime: new Date(schedule.endTime).toISOString().slice(0, 16),
            room: schedule.room
        });
        setError('');
    };

    const handleCancelEdit = () => {
        setEditingSchedule(null);
        setEditForm({
            principal: '',
            examinator: '',
            supervisor: '',
            startTime: '',
            endTime: '',
            room: ''
        });
        setError('');
    };

    const handleUpdateSchedule = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/schedule/${editingSchedule}`, {
                ...editForm,
                startTime: new Date(editForm.startTime).toISOString(),
                endTime: new Date(editForm.endTime).toISOString()
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            handleCancelEdit();
            fetchSchedules();
        } catch (err) {
            setError(err.response?.data?.message || "Error updating schedule");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this schedule?")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/schedule/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchSchedules();
        } catch (err) {
            alert("Error deleting schedule");
        }
    };

    const handleAutoPlan = async () => {
        setLoading(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/schedule/auto-plan`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchSchedules();
        } catch (err) {
            alert(err.response?.data?.message || "Error during planning");
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/schedule/export`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'jury_schedule_export.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert("Error exporting schedule");
        }
    };

    useEffect(() => {
        fetchSchedules();
        fetchProfessors();
    }, []);

    // Timetable view logic
    const generateTimetable = () => {
        const rooms = [...new Set(schedules.map(s => s.room))].sort();
        const timeSlots = [...new Set(schedules.map(s => new Date(s.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })))].sort();

        const timetableData = {};
        schedules.forEach(schedule => {
            const time = new Date(schedule.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const room = schedule.room;
            const key = `${time}-${room}`;
            timetableData[key] = schedule;
        });

        return { rooms, timeSlots, timetableData };
    };

    const { rooms, timeSlots, timetableData } = generateTimetable();

    return (
        <Container fluid className="py-4" style={{ marginTop: '70px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            <Container fluid>
                <h2 className="mb-4 fw-bold">📅 Jury Planning</h2>

                {/* Action Buttons */}
                <Card className="border-0 shadow-sm mb-4">
                    <Card.Body>
                        <Row className="align-items-center">
                            <Col xs={12} md="auto" className="mb-3 mb-md-0">
                                <div className="d-flex gap-2 flex-wrap">
                                    <Button
                                        variant="success"
                                        onClick={handleAutoPlan}
                                        disabled={loading}
                                    >
                                        {loading ? "Planning..." : "🤖 Run Auto-Planning"}
                                    </Button>
                                    <Button variant="primary" onClick={handleExport}>
                                        📥 Export to Excel
                                    </Button>
                                </div>
                            </Col>
                            <Col xs={12} md="auto" className="ms-md-auto">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="small fw-semibold text-muted">View:</span>
                                    <ButtonGroup size="sm">
                                        <Button
                                            variant={viewMode === 'cards' ? 'primary' : 'outline-primary'}
                                            onClick={() => setViewMode('cards')}
                                        >
                                            📋 Cards
                                        </Button>
                                        <Button
                                            variant={viewMode === 'timetable' ? 'primary' : 'outline-primary'}
                                            onClick={() => setViewMode('timetable')}
                                        >
                                            📊 Timetable
                                        </Button>
                                    </ButtonGroup>
                                </div>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Edit Modal */}
                <Modal show={editingSchedule !== null} onHide={handleCancelEdit} size="lg">
                    <Modal.Header closeButton>
                        <Modal.Title>Edit Schedule</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Form onSubmit={handleUpdateSchedule}>
                            <Row>
                                <Col md={6} className="mb-3">
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Principal</Form.Label>
                                        <Form.Select
                                            value={editForm.principal}
                                            onChange={(e) => setEditForm({ ...editForm, principal: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Principal</option>
                                            {professors.map(prof => (
                                                <option key={prof._id} value={prof._id}>{prof.name}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Examinator</Form.Label>
                                        <Form.Select
                                            value={editForm.examinator}
                                            onChange={(e) => setEditForm({ ...editForm, examinator: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Examinator</option>
                                            {professors.map(prof => (
                                                <option key={prof._id} value={prof._id}>{prof.name}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Supervisor</Form.Label>
                                        <Form.Select
                                            value={editForm.supervisor}
                                            onChange={(e) => setEditForm({ ...editForm, supervisor: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Supervisor</option>
                                            {professors.map(prof => (
                                                <option key={prof._id} value={prof._id}>{prof.name}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Room</Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={editForm.room}
                                            onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Start Time</Form.Label>
                                        <Form.Control
                                            type="datetime-local"
                                            value={editForm.startTime}
                                            onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">End Time</Form.Label>
                                        <Form.Control
                                            type="datetime-local"
                                            value={editForm.endTime}
                                            onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                            <div className="d-flex gap-2 justify-content-end">
                                <Button variant="secondary" onClick={handleCancelEdit}>
                                    Cancel
                                </Button>
                                <Button variant="success" type="submit">
                                    Update Schedule
                                </Button>
                            </div>
                        </Form>
                    </Modal.Body>
                </Modal>

                {/* Cards View */}
                {viewMode === 'cards' && (
                    <Row className="g-4">
                        {schedules.map((schedule) => (
                            <Col key={schedule._id} lg={6} xl={4}>
                                <Card className="border-0 shadow-sm h-100 border-start border-success border-4">
                                    <Card.Body>
                                        <h5 className="fw-bold mb-3">📅 {schedule.thesis?.title || "Untitled Thesis"}</h5>

                                        <div className="mb-3">
                                            <div className="d-flex justify-content-between mb-2">
                                                <span className="fw-semibold">Room:</span>
                                                <Badge bg="info">{schedule.room}</Badge>
                                            </div>
                                            <div className="small text-muted">
                                                <div><strong>Start:</strong> {new Date(schedule.startTime).toLocaleString()}</div>
                                                <div><strong>End:</strong> {new Date(schedule.endTime).toLocaleTimeString()}</div>
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <h6 className="fw-semibold mb-2">Jury Composition:</h6>
                                            <ListGroup variant="flush" className="small">
                                                <ListGroup.Item className="px-0 py-1 border-0">
                                                    👤 <strong>Student:</strong> {schedule.student?.name}
                                                </ListGroup.Item>
                                                <ListGroup.Item className="px-0 py-1 border-0">
                                                    👨‍🏫 <strong>Supervisor:</strong> {schedule.supervisor?.name}
                                                </ListGroup.Item>
                                                <ListGroup.Item className="px-0 py-1 border-0">
                                                    🎯 <strong>Principal:</strong> {schedule.principal?.name}
                                                </ListGroup.Item>
                                                <ListGroup.Item className="px-0 py-1 border-0">
                                                    🔍 <strong>Examinator:</strong> {schedule.examinator?.name}
                                                </ListGroup.Item>
                                            </ListGroup>
                                        </div>

                                        <div className="d-flex gap-2">
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={() => handleEdit(schedule)}
                                            >
                                                ✏️ Edit
                                            </Button>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => handleDelete(schedule._id)}
                                            >
                                                🗑️ Remove
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                )}

                {/* Timetable View */}
                {viewMode === 'timetable' && (
                    <Card className="border-0 shadow-sm">
                        <Card.Body className="p-0">
                            <div className="table-responsive">
                                <Table bordered hover className="mb-0">
                                    <thead className="table-primary">
                                        <tr>
                                            <th className="text-center" style={{ minWidth: '100px' }}>Time</th>
                                            {rooms.map(room => (
                                                <th key={room} className="text-center" style={{ minWidth: '300px' }}>
                                                    {room}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timeSlots.map(time => (
                                            <tr key={time}>
                                                <td className="text-center fw-bold align-middle bg-light">
                                                    {time}
                                                </td>
                                                {rooms.map(room => {
                                                    const schedule = timetableData[`${time}-${room}`];
                                                    return (
                                                        <td key={`${time}-${room}`} className="p-2">
                                                            {schedule ? (
                                                                <div className="small">
                                                                    <div className="fw-bold text-primary mb-1">
                                                                        {schedule.thesis?.title}
                                                                    </div>
                                                                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                                                        <div>👤 {schedule.student?.name}</div>
                                                                        <div>👨‍🏫 {schedule.supervisor?.name}</div>
                                                                        <div>🎯 {schedule.principal?.name}</div>
                                                                        <div>🔍 {schedule.examinator?.name}</div>
                                                                    </div>
                                                                    <div className="mt-2">
                                                                        <Button
                                                                            variant="outline-primary"
                                                                            size="sm"
                                                                            onClick={() => handleEdit(schedule)}
                                                                            className="me-1"
                                                                        >
                                                                            ✏️
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline-danger"
                                                                            size="sm"
                                                                            onClick={() => handleDelete(schedule._id)}
                                                                        >
                                                                            🗑️
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center text-muted small">
                                                                    —
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        </Card.Body>
                    </Card>
                )}

                {schedules.length === 0 && (
                    <Alert variant="info" className="text-center">
                        No schedules planned yet. Click "Run Auto-Planning" to generate schedules automatically!
                    </Alert>
                )}
            </Container>
        </Container>
    );
};

export default Planning;
