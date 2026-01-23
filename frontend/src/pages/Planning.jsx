import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Button, Modal, Form, Badge, ListGroup, Alert, ButtonGroup, Table, Dropdown } from "react-bootstrap";

const Planning = () => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [professors, setProfessors] = useState([]);
    const [viewMode, setViewMode] = useState('timetable');
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
            principal: schedule.principal?._id || '',
            examinator: schedule.examinator?._id || '',
            supervisor: schedule.supervisor?._id || '',
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

    const quickUpdateRoom = async (scheduleId, newRoom) => {
        try {
            const schedule = schedules.find(s => s._id === scheduleId);
            await axios.put(`${import.meta.env.VITE_API_URL}/api/schedule/${scheduleId}`, {
                room: newRoom,
                principal: schedule.principal?._id,
                examinator: schedule.examinator?._id,
                supervisor: schedule.supervisor?._id,
                startTime: schedule.startTime,
                endTime: schedule.endTime
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchSchedules();
        } catch (err) {
            alert(err.response?.data?.message || "Error updating room");
        }
    };

    const quickUpdateTime = async (scheduleId, timeShift) => {
        try {
            const schedule = schedules.find(s => s._id === scheduleId);
            const currentStart = new Date(schedule.startTime);
            const currentEnd = new Date(schedule.endTime);

            currentStart.setMinutes(currentStart.getMinutes() + (timeShift * 35));
            currentEnd.setMinutes(currentEnd.getMinutes() + (timeShift * 35));

            await axios.put(`${import.meta.env.VITE_API_URL}/api/schedule/${scheduleId}`, {
                startTime: currentStart.toISOString(),
                endTime: currentEnd.toISOString(),
                room: schedule.room,
                principal: schedule.principal?._id,
                examinator: schedule.examinator?._id,
                supervisor: schedule.supervisor?._id
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchSchedules();
        } catch (err) {
            alert(err.response?.data?.message || "Error updating time");
        }
    };

    const quickSwapProfessor = async (scheduleId, role, newProfId) => {
        try {
            const schedule = schedules.find(s => s._id === scheduleId);
            const updates = {
                principal: schedule.principal?._id,
                examinator: schedule.examinator?._id,
                supervisor: schedule.supervisor?._id,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                room: schedule.room
            };
            updates[role] = newProfId;

            await axios.put(`${import.meta.env.VITE_API_URL}/api/schedule/${scheduleId}`, updates, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchSchedules();
        } catch (err) {
            alert(err.response?.data?.message || "Error swapping professor");
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

    const handleDeleteAllSchedules = async () => {
        if (!window.confirm("Are you sure you want to delete ALL schedules? This will reset all thesis statuses back to 'approved'.")) return;
        try {
            const res = await axios.delete(`${import.meta.env.VITE_API_URL}/api/schedule/all`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            alert(res.data.message);
            fetchSchedules();
        } catch (err) {
            alert(err.response?.data?.message || "Error deleting all schedules");
        }
    };

    const handleAutoPlan = async () => {
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/schedule/auto-plan`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            alert(`${res.data.message}\n- Newly Scheduled: ${res.data.scheduled}\n- Fixed/Updated: ${res.data.fixed}`);
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

    const generateTimetable = () => {
        const availableRooms = ["Room 110/DI", "Room 111/DI", "Room 112/DI", "Room 113/DI"];
        const dates = [...new Set(schedules.map(s => new Date(s.startTime).toLocaleDateString()))].sort();

        return dates.map(date => {
            const daySchedules = schedules.filter(s => new Date(s.startTime).toLocaleDateString() === date);
            const roomsFromSchedules = [...new Set(daySchedules.map(s => s.room))];
            const rooms = [...new Set([...availableRooms, ...roomsFromSchedules])].sort();

            const timeSlots = [...new Set(daySchedules.map(s => {
                const d = new Date(s.startTime);
                return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            }))].sort();

            const timetableData = {};
            daySchedules.forEach(schedule => {
                const time = new Date(schedule.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                timetableData[`${time}-${schedule.room}`] = schedule;
            });

            return { date, rooms, timeSlots, timetableData };
        });
    };

    const dayWiseTimetables = generateTimetable();
    const availableRooms = ["Room 110/DI", "Room 111/DI", "Room 112/DI", "Room 113/DI"];

    // Statistical Summary Logic
    const generateSummary = () => {
        const stats = {};
        professors.forEach(p => {
            stats[p._id] = { name: p.name, supervisor: 0, principal: 0, examinator: 0, total: 0 };
        });

        schedules.forEach(s => {
            if (s.supervisor?._id && stats[s.supervisor._id]) {
                stats[s.supervisor._id].supervisor++;
                stats[s.supervisor._id].total++;
            }
            if (s.principal?._id && stats[s.principal._id]) {
                stats[s.principal._id].principal++;
                stats[s.principal._id].total++;
            }
            if (s.examinator?._id && stats[s.examinator._id]) {
                stats[s.examinator._id].examinator++;
                stats[s.examinator._id].total++;
            }
        });

        return Object.values(stats).sort((a, b) => b.total - a.total);
    };

    const professorStats = generateSummary();

    return (
        <Container fluid className="py-4" style={{ marginTop: '70px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            <Container fluid>
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="fw-bold m-0">📅 Jury Planning</h2>
                    <ButtonGroup size="sm">
                        <Button variant={viewMode === 'timetable' ? 'primary' : 'outline-primary'} onClick={() => setViewMode('timetable')}>📊 Timetable</Button>
                        <Button variant={viewMode === 'cards' ? 'primary' : 'outline-primary'} onClick={() => setViewMode('cards')}>📋 List View</Button>
                        <Button variant={viewMode === 'summary' ? 'primary' : 'outline-primary'} onClick={() => setViewMode('summary')}>📈 Summary</Button>
                    </ButtonGroup>
                </div>

                <Card className="border-0 shadow-sm mb-4">
                    <Card.Body className="d-flex gap-2 flex-wrap">
                        <Button variant="success" onClick={handleAutoPlan} disabled={loading}>{loading ? "Planning..." : "🤖 Run Auto-Planning"}</Button>
                        <Button variant="outline-danger" onClick={handleDeleteAllSchedules}>🗑️ Clear All</Button>
                        <Button variant="primary" onClick={handleExport}>📥 Export Excel</Button>
                    </Card.Body>
                </Card>

                <Modal show={editingSchedule !== null} onHide={handleCancelEdit} size="lg">
                    <Modal.Header closeButton><Modal.Title>Edit Schedule</Modal.Title></Modal.Header>
                    <Modal.Body>
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Form onSubmit={handleUpdateSchedule}>
                            <Row>
                                <Col md={6} className="mb-3">
                                    <Form.Label className="fw-semibold">Principal</Form.Label>
                                    <Form.Select value={editForm.principal} onChange={(e) => setEditForm({ ...editForm, principal: e.target.value })} required>
                                        <option value="">Select Principal</option>
                                        {professors.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                    </Form.Select>
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Label className="fw-semibold">Examinator</Form.Label>
                                    <Form.Select value={editForm.examinator} onChange={(e) => setEditForm({ ...editForm, examinator: e.target.value })} required>
                                        <option value="">Select Examinator</option>
                                        {professors.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                    </Form.Select>
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Label className="fw-semibold">Supervisor</Form.Label>
                                    <Form.Select value={editForm.supervisor} onChange={(e) => setEditForm({ ...editForm, supervisor: e.target.value })} required>
                                        <option value="">Select Supervisor</option>
                                        {professors.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                    </Form.Select>
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Label className="fw-semibold">Room</Form.Label>
                                    <Form.Control type="text" value={editForm.room} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} required />
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Label className="fw-semibold">Start Time</Form.Label>
                                    <Form.Control type="datetime-local" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} required />
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Label className="fw-semibold">End Time</Form.Label>
                                    <Form.Control type="datetime-local" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} required />
                                </Col>
                            </Row>
                            <div className="d-flex gap-2 justify-content-end mt-3">
                                <Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
                                <Button variant="success" type="submit">Update Schedule</Button>
                            </div>
                        </Form>
                    </Modal.Body>
                </Modal>

                {viewMode === 'cards' && (
                    <Row className="g-4">
                        {schedules.map((schedule) => (
                            <Col key={schedule._id} lg={6} xl={4}>
                                <Card className="border-0 shadow-sm h-100 border-start border-success border-4">
                                    <Card.Body>
                                        <h5 className="fw-bold mb-3">📅 {schedule.thesis?.title || "Untitled"}</h5>
                                        <div className="mb-3 small text-muted">
                                            <div className="d-flex justify-content-between mb-1"><strong>Room:</strong> <Badge bg="info">{schedule.room}</Badge></div>
                                            <div><strong>Start:</strong> {new Date(schedule.startTime).toLocaleString()}</div>
                                        </div>
                                        <ListGroup variant="flush" className="small mb-3">
                                            <ListGroup.Item className="px-0 py-1 border-0">👤 <strong>Student:</strong> {schedule.student?.name}</ListGroup.Item>
                                            <ListGroup.Item className="px-0 py-1 border-0">👨‍🏫 <strong>SV:</strong> {schedule.supervisor?.name}</ListGroup.Item>
                                            <ListGroup.Item className="px-0 py-1 border-0">🎯 <strong>PR:</strong> {schedule.principal?.name}</ListGroup.Item>
                                            <ListGroup.Item className="px-0 py-1 border-0">🔍 <strong>EX:</strong> {schedule.examinator?.name}</ListGroup.Item>
                                        </ListGroup>
                                        <div className="d-flex gap-2">
                                            <Button variant="outline-primary" size="sm" onClick={() => handleEdit(schedule)}>✏️ Edit</Button>
                                            <Button variant="outline-danger" size="sm" onClick={() => handleDelete(schedule._id)}>🗑️ Remove</Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                )}

                {viewMode === 'timetable' && (
                    <div className="d-flex flex-column gap-5">
                        {dayWiseTimetables.map(({ date, rooms, timeSlots, timetableData }) => (
                            <div key={date}>
                                <h4 className="fw-bold mb-3 text-secondary border-bottom pb-2">🗓️ Schedule for {date}</h4>
                                <Card className="border-0 shadow-sm overflow-hidden">
                                    <div className="table-responsive">
                                        <Table bordered hover size="sm" className="mb-0 text-center bg-white">
                                            <thead className="table-dark">
                                                <tr>
                                                    <th style={{ width: '80px', fontSize: '0.8rem' }}>Time</th>
                                                    {rooms.map(room => (
                                                        <th key={room} style={{ minWidth: '220px', fontSize: '0.8rem' }}>{room}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {timeSlots.map(time => (
                                                    <tr key={time}>
                                                        <td className="fw-bold align-middle bg-light small" style={{ fontSize: '0.75rem' }}>{time}</td>
                                                        {rooms.map(room => {
                                                            const s = timetableData[`${time}-${room}`];
                                                            return (
                                                                <td key={`${time}-${room}`} className="p-1 align-middle" style={{ height: '140px' }}>
                                                                    {s ? (
                                                                        <div className="text-start p-2 rounded h-100 d-flex flex-column justify-content-between shadow-sm border-start border-3 border-primary" style={{ backgroundColor: '#fff', fontSize: '0.72rem' }}>
                                                                            <div>
                                                                                <div className="fw-bold text-primary mb-1" style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.2' }}>{s.thesis?.title}</div>
                                                                                <div className="text-muted">
                                                                                    <div className="text-truncate">👤 <strong>{s.student?.name}</strong></div>
                                                                                    <div className="d-flex flex-column">
                                                                                        <span>👨‍🏫 {s.supervisor?.name?.split(' ').pop()}</span>
                                                                                        <span>🎯 {s.principal?.name?.split(' ').pop()}</span>
                                                                                        <span>🔍 {s.examinator?.name?.split(' ').pop()}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="d-flex gap-1 pt-1 mt-1 border-top align-items-center">
                                                                                <Dropdown size="sm">
                                                                                    <Dropdown.Toggle variant="outline-secondary" size="sm" className="border-0 px-1 py-0">🏢</Dropdown.Toggle>
                                                                                    <Dropdown.Menu className="shadow border-0">
                                                                                        {availableRooms.map(r => <Dropdown.Item key={r} onClick={() => quickUpdateRoom(s._id, r)} active={r === s.room}>{r}</Dropdown.Item>)}
                                                                                    </Dropdown.Menu>
                                                                                </Dropdown>
                                                                                <ButtonGroup size="sm">
                                                                                    <Button variant="outline-secondary" className="border-0 px-1 py-0" onClick={() => quickUpdateTime(s._id, -1)}>⬅️</Button>
                                                                                    <Button variant="outline-secondary" className="border-0 px-1 py-0" onClick={() => quickUpdateTime(s._id, 1)}>➡️</Button>
                                                                                </ButtonGroup>
                                                                                <Button variant="outline-danger" size="sm" className="border-0 px-1 py-0 ms-auto" onClick={() => handleDelete(s._id)}>🗑️</Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : null}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                </Card>
                            </div>
                        ))}
                    </div>
                )}

                {viewMode === 'summary' && (
                    <div className="d-flex flex-column gap-4">
                        {[...new Set(schedules.map(s => new Date(s.startTime).toLocaleDateString()))].sort((a, b) => new Date(a) - new Date(b)).map(date => {
                            const daySchedules = schedules.filter(s => new Date(s.startTime).toLocaleDateString() === date);
                            const rooms = [...new Set(daySchedules.map(s => s.room))].sort();

                            return (
                                <div key={date} className="mb-4">
                                    <h5 className="fw-bold mb-3 d-flex align-items-center">
                                        <span className="badge bg-primary me-2">{date}</span>
                                        Jury Committee Roster
                                    </h5>
                                    <Card className="border-0 shadow-sm overflow-hidden">
                                        <Table bordered hover size="sm" className="mb-0">
                                            <thead className="table-dark">
                                                <tr className="small text-center">
                                                    <th style={{ width: '150px' }}>Room</th>
                                                    <th className="text-start ps-3">Jury Committee (Principal | SV | EX)</th>
                                                    <th style={{ width: '120px' }}>Series Size</th>
                                                </tr>
                                            </thead>
                                            <tbody className="small">
                                                {rooms.map(room => {
                                                    const roomSchedules = daySchedules.filter(s => s.room === room)
                                                        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

                                                    const committees = [];
                                                    roomSchedules.forEach(s => {
                                                        const juryKey = `${s.principal?._id}-${s.supervisor?._id}-${s.examinator?._id}`;
                                                        if (committees.length > 0 && committees[committees.length - 1].key === juryKey) {
                                                            committees[committees.length - 1].count++;
                                                        } else {
                                                            committees.push({
                                                                key: juryKey,
                                                                names: [s.principal?.name, s.supervisor?.name, s.examinator?.name],
                                                                count: 1
                                                            });
                                                        }
                                                    });

                                                    return committees.map((c, idx) => (
                                                        <tr key={`${room}-${idx}`}>
                                                            {idx === 0 && (
                                                                <td rowSpan={committees.length} className="text-center fw-bold bg-light align-middle border-end">{room}</td>
                                                            )}
                                                            <td className="py-2 text-start ps-3 align-middle">
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <Badge bg="white" text="dark" className="border shadow-sm py-2">
                                                                        <span className="text-primary fw-bold">1. {c.names[0] || "—"}</span>
                                                                        <span className="mx-2 text-muted">|</span>
                                                                        <span className="fw-bold text-success">2. {c.names[1] || "—"}</span>
                                                                        <span className="mx-2 text-muted">|</span>
                                                                        <span className="text-secondary fw-bold">3. {c.names[2] || "—"}</span>
                                                                    </Badge>
                                                                </div>
                                                            </td>
                                                            <td className="text-center align-middle">
                                                                <Badge bg="info" pill className="px-3">
                                                                    {c.count} sessions
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ));
                                                })}
                                            </tbody>
                                        </Table>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                )}

                {schedules.length === 0 && !loading && <Alert variant="info" className="text-center mt-4">No schedules planned yet. Click "Run Auto-Planning" to generate schedules!</Alert>}
            </Container>
        </Container>
    );
};

export default Planning;
