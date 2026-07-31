import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Button, Modal, Form, Table, Alert, Badge } from "react-bootstrap";
import { useNotification } from "../context/NotificationContext";
import { useSemester } from "../context/SemesterContext";

const ManualPlanning = () => {
    const { notify, confirm } = useNotification();
    const { activeSemester } = useSemester();
    const token = localStorage.getItem("token");

    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [professors, setProfessors] = useState([]);
    const [courseCodes, setCourseCodes] = useState([]);
    const [courseCode, setCourseCode] = useState("");
    const [controls, setControls] = useState({
        startDate: new Date().toISOString().slice(0, 10),
        numDays: 3,
        roomCount: 3,
        sessionsPerDay: 2,
    });
    const [editing, setEditing] = useState(null); // { dayIdx, sessIdx, commIdx, room, principal, examinator, supervisor }

    const fetchCourseCodes = async () => {
        if (!activeSemester?._id) return;
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/theses`, {
                params: { semester: activeSemester._id },
                headers: { Authorization: `Bearer ${token}` },
            });
            const codes = [...new Set((res.data || []).map(t => t.courseCode).filter(Boolean))].sort();
            setCourseCodes(codes);
            setCourseCode(prev => (codes.includes(prev) ? prev : (codes[0] || "")));
        } catch (err) {
            console.error("Fetch course codes error:", err.response?.data || err.message);
        }
    };

    const fetchPlan = async () => {
        if (!activeSemester?._id || !courseCode) return;
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/manual-plan`, {
                params: { semester: activeSemester._id, courseCode },
                headers: { Authorization: `Bearer ${token}` },
            });
            setPlan(res.data || null);
        } catch (err) {
            notify(err.response?.data?.message || "Error loading manual plan");
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

    useEffect(() => {
        fetchCourseCodes();
        fetchProfessors();
    }, [activeSemester]);

    useEffect(() => {
        setPlan(null);
        fetchPlan();
    }, [courseCode, activeSemester]);

    const handleAutoPlan = async () => {
        if (!activeSemester?._id || !courseCode) return;
        if (!(await confirm(
            `Run manual auto-planning for the theses of course ${courseCode} (${activeSemester.displayName})?\n\nIt will overwrite the current manual plan for this course with a new one arranged like the reference Excel (days, Sang/Chieu sessions, committees of 3 professors with thesis counts).`,
            "Run Manual Planning"
        ))) return;

        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/manual-plan/auto-plan`, {
                semester: activeSemester._id,
                courseCode,
                startDate: controls.startDate,
                numDays: controls.numDays,
                roomCount: controls.roomCount,
                sessionsPerDay: controls.sessionsPerDay,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPlan(res.data.plan);
            notify(res.data.message + ` (${res.data.thesisCount} theses)`);
        } catch (err) {
            notify(err.response?.data?.message || "Error during manual planning");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!plan || !activeSemester?._id || !courseCode) return;
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/manual-plan`, {
                semester: activeSemester._id,
                courseCode,
                days: plan.days,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            notify("Manual plan saved");
            fetchPlan();
        } catch (err) {
            notify(err.response?.data?.message || "Error saving manual plan");
        }
    };

    const handleClear = async () => {
        if (!activeSemester?._id || !courseCode) return;
        if (!(await confirm(
            `Delete the manual plan for course ${courseCode}?`,
            "Delete Manual Plan"
        ))) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/manual-plan`, {
                params: { semester: activeSemester._id, courseCode },
                headers: { Authorization: `Bearer ${token}` },
            });
            setPlan(null);
            notify("Manual plan deleted");
        } catch (err) {
            notify(err.response?.data?.message || "Error deleting manual plan");
        }
    };

    const handleExport = async () => {
        if (!activeSemester?._id || !plan || !courseCode) return;
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/manual-plan/export`, {
                params: { semester: activeSemester._id, courseCode },
                headers: { Authorization: `Bearer ${token}` },
                responseType: "blob",
            });
            const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Xep lich LVTN ${courseCode}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            notify(err.response?.data?.message || "Error exporting manual plan");
        }
    };

    const openEdit = (dayIdx, sessIdx, commIdx) => {
        const c = plan.days[dayIdx].sessions[sessIdx].committees[commIdx];
        setEditing({
            dayIdx,
            sessIdx,
            commIdx,
            room: c.room || "",
            principal: c.principal?._id || "",
            examinator: c.examinator?._id || "",
            supervisor: c.supervisor?._id || "",
        });
    };

    const saveEdit = () => {
        const { dayIdx, sessIdx, commIdx } = editing;
        const newPlan = { ...plan, days: plan.days.map(d => ({ ...d })) };
        const committee = newPlan.days[dayIdx].sessions[sessIdx].committees[commIdx];
        committee.room = editing.room;
        committee.principal = professors.find(p => p._id === editing.principal) || committee.principal;
        committee.examinator = professors.find(p => p._id === editing.examinator) || committee.examinator;
        committee.supervisor = professors.find(p => p._id === editing.supervisor) || committee.supervisor;
        setPlan(newPlan);
        setEditing(null);
        notify("Committee updated — click Save Changes to persist");
    };

    const dateLabel = (d) => {
        const date = new Date(d);
        return `${date.getDate()}/${date.getMonth() + 1}`;
    };

    const totalTheses = plan?.days?.reduce(
        (sum, day) => sum + day.sessions.reduce(
            (s, sess) => s + sess.committees.reduce((csum, c) => csum + (c.thesisIds?.length || 0), 0), 0
        ), 0
    ) || 0;

    return (
        <Container fluid className="py-4">
            <Card className="border-0 shadow-sm mb-4">
                <Card.Body>
                    <h5 className="fw-bold mb-3">Manual Planning</h5>
                    <p className="text-muted mb-3 small">
                        Arrange juries like the reference Excel: each day has <b>Sang</b>/<b>Chieu</b> sessions, each
                        session has up to 4 committees of 3 professors. Auto-planning
                        distributes the approved theses across the committees by count — no per-thesis details.
                    </p>
                    <Row className="g-3 mb-2">
                        <Col md={4} sm={6}>
                            <Form.Label className="fw-semibold small mb-1">Course Code</Form.Label>
                            <Form.Select
                                value={courseCode}
                                onChange={(e) => setCourseCode(e.target.value)}
                            >
                                {courseCodes.length === 0 && <option value="">No courses found</option>}
                                {courseCodes.map(c => <option key={c} value={c}>{c}</option>)}
                            </Form.Select>
                        </Col>
                        <Col md={3} sm={6}>
                            <Form.Label className="fw-semibold small mb-1">Start Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={controls.startDate}
                                onChange={(e) => setControls({ ...controls, startDate: e.target.value })}
                            />
                        </Col>
                        <Col md={2} sm={6}>
                            <Form.Label className="fw-semibold small mb-1">Number of Days</Form.Label>
                            <Form.Control
                                type="number"
                                min="1"
                                max="14"
                                value={controls.numDays}
                                onChange={(e) => setControls({ ...controls, numDays: parseInt(e.target.value) || 1 })}
                            />
                        </Col>
                        <Col md={3} sm={6} className="d-flex align-items-end">
                            <Button variant="success" className="w-100" onClick={handleAutoPlan} disabled={loading || !courseCode}>
                                {loading ? "Planning..." : "✨ Run Auto-Planning"}
                            </Button>
                        </Col>
                    </Row>
                    <Row className="g-3 mb-3">
                        <Col md={4} sm={6}>
                            <Form.Label className="fw-semibold small mb-1">Committees per Session</Form.Label>
                            <Form.Select
                                value={controls.roomCount}
                                onChange={(e) => setControls({ ...controls, roomCount: parseInt(e.target.value) })}
                            >
                                <option value="1">1 Committee</option>
                                <option value="2">2 Committees</option>
                                <option value="3">3 Committees</option>
                                <option value="4">4 Committees</option>
                            </Form.Select>
                        </Col>
                        <Col md={3} sm={6}>
                            <Form.Label className="fw-semibold small mb-1">Sessions per Day</Form.Label>
                            <Form.Select
                                value={controls.sessionsPerDay}
                                onChange={(e) => setControls({ ...controls, sessionsPerDay: parseInt(e.target.value) })}
                            >
                                <option value="2">Sang + Chieu</option>
                                <option value="1">Sang only</option>
                            </Form.Select>
                        </Col>
                    </Row>
                    {plan && (
                        <div className="d-flex gap-2 flex-wrap">
                            <Badge bg="secondary">Course {courseCode}</Badge>
                            <Badge bg="secondary">{totalTheses} theses planned</Badge>
                            <Button variant="outline-success" size="sm" onClick={handleSave}>💾 Save Changes</Button>
                            <Button variant="outline-primary" size="sm" onClick={handleExport}>📥 Export Excel</Button>
                            <Button variant="outline-danger" size="sm" onClick={handleClear}>🗑 Delete Plan</Button>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {loading && <Alert variant="info">Generating manual plan...</Alert>}

            {!plan && !loading && (
                <Card className="border-0 shadow-sm">
                    <Card.Body className="text-center text-muted py-5">
                        <div className="fs-1 mb-3">🗓️</div>
                        <h5>{courseCode ? `No manual plan for ${courseCode} yet` : "No course code available"}</h5>
                        <p className="mb-0">Select a course code, set the options above and click <b>Run Auto-Planning</b> to build the plan.</p>
                    </Card.Body>
                </Card>
            )}

            {plan && plan.days.map((day, dayIdx) => (
                <Card key={day._id || dayIdx} className="border-0 shadow-sm mb-4">
                    <Card.Header className="bg-white fw-bold text-secondary border-bottom">
                        🗓️ Ngay {dateLabel(day.date)}
                    </Card.Header>
                    <Card.Body>
                        {day.sessions.map((sess, sessIdx) => (
                            <div key={sess._id || sessIdx} className="mb-4">
                                <h6 className={`fw-bold mb-2 ${sess.session === "Sang" ? "text-primary" : "text-warning"}`}>
                                    {sess.session}
                                </h6>
                                <div className="table-responsive">
                                    <Table bordered size="sm" className="mb-0 bg-white text-center align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                {sess.committees.map((c, commIdx) => (
                                                    <th key={commIdx} className="align-middle">
                                                        <button
                                                            className="btn btn-sm btn-outline-secondary"
                                                            style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                                                            onClick={() => openEdit(dayIdx, sessIdx, commIdx)}
                                                            title="Edit committee"
                                                        >
                                                            <span className="fw-bold">{c.principal?.name || "—"}</span>{" "}
                                                            <span className="text-primary fw-bold">{c.thesisIds?.length || 0}</span>
                                                        </button>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                {sess.committees.map((c, commIdx) => (
                                                    <td key={commIdx}>{c.examinator?.name || "—"}</td>
                                                ))}
                                            </tr>
                                            <tr>
                                                {sess.committees.map((c, commIdx) => (
                                                    <td key={commIdx}>{c.supervisor?.name || "—"}</td>
                                                ))}
                                            </tr>
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        ))}
                    </Card.Body>
                </Card>
            ))}

            {/* Committee edit modal */}
            <Modal show={editing !== null} onHide={() => setEditing(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>✏️ Edit Committee</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">Member 1 (President)</Form.Label>
                        <Form.Select value={editing?.principal || ""} onChange={(e) => setEditing({ ...editing, principal: e.target.value })}>
                            <option value="">Select...</option>
                            {professors.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">Member 2</Form.Label>
                        <Form.Select value={editing?.examinator || ""} onChange={(e) => setEditing({ ...editing, examinator: e.target.value })}>
                            <option value="">Select...</option>
                            {professors.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">Member 3</Form.Label>
                        <Form.Select value={editing?.supervisor || ""} onChange={(e) => setEditing({ ...editing, supervisor: e.target.value })}>
                            <option value="">Select...</option>
                            {professors.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </Form.Select>
                    </Form.Group>
                    <div className="d-flex gap-2 justify-content-end mt-3">
                        <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button variant="success" onClick={saveEdit}>Save Committee</Button>
                    </div>
                </Modal.Body>
            </Modal>
        </Container>
    );
};

export default ManualPlanning;
