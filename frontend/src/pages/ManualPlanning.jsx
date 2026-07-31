import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Button, Form, Alert, Badge, Dropdown } from "react-bootstrap";
import { useNotification } from "../context/NotificationContext";
import { useSemester } from "../context/SemesterContext";

const ProfessorDropdown = ({ profs, value, label, bg, color, onSelect }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    return (
        <Dropdown show={open} onToggle={(isOpen) => { setOpen(isOpen); if (!isOpen) setSearch(''); }}>
            <Dropdown.Toggle as="div" className="d-flex align-items-center gap-1 px-2 py-2" style={{ backgroundColor: bg, cursor: 'pointer' }}>
                <span style={{ fontSize: '0.7rem', color, fontWeight: 700, minWidth: '24px' }}>{label}</span>
                <span className="fw-bold text-truncate" title={value?.name} style={{ fontSize: '0.9rem', color }}>{value?.name || <span className="text-danger">⚠️</span>}</span>
                <span className="ms-auto text-muted" style={{ fontSize: '0.65rem' }}>▾</span>
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ maxHeight: '350px', overflowY: 'auto', minWidth: '240px' }}>
                <div className="px-3 py-1 border-bottom bg-light sticky-top">
                    <Form.Control size="sm" placeholder="Search professor..." value={search} onChange={(e) => setSearch(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus />
                </div>
                {profs.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase())).map(p => (
                    <Dropdown.Item key={p._id} onClick={() => { onSelect(p._id); setSearch(''); }} active={p._id === value?._id}>{p.name}</Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    );
};

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
        capacity: 6,
        roomCount: 3,
        sessionsPerDay: 2,
    });

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
                capacity: controls.capacity,
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

    const quickSwapMember = async (dayIdx, sessIdx, commIdx, role, newProfId) => {
        if (!plan || !activeSemester?._id || !courseCode) return;
        const newPlan = {
            ...plan,
            days: plan.days.map((d, di) => ({
                ...d,
                sessions: d.sessions.map((s, si) => ({
                    ...s,
                    committees: s.committees.map((c, ci) => (di === dayIdx && si === sessIdx && ci === commIdx
                        ? { ...c, [role]: professors.find(p => p._id === newProfId) || c[role] }
                        : c)),
                })),
            })),
        };
        setPlan(newPlan);
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/manual-plan`, {
                semester: activeSemester._id,
                courseCode,
                days: newPlan.days,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchPlan();
        } catch (err) {
            notify(err.response?.data?.message || "Error updating committee");
            fetchPlan();
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
                        Arrange juries like the reference Excel: each committee is headed by the <b>thesis supervisor</b>,
                        who sits as the 1st member with their own theses (the number shown), plus 2 other members.
                        Days are Sang/Chieu sessions with up to 4 committees per session. The plan shows only counts —
                        no per-thesis details.
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
                            <Form.Label className="fw-semibold small mb-1">Theses per Committee</Form.Label>
                            <Form.Control
                                type="number"
                                min="1"
                                max="14"
                                value={controls.capacity}
                                onChange={(e) => setControls({ ...controls, capacity: parseInt(e.target.value) || 1 })}
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
                                <div className="d-flex flex-wrap gap-3">
                                    {sess.committees.map((c, commIdx) => (
                                        <div key={commIdx} className="border rounded shadow-sm bg-white overflow-hidden" style={{ width: '280px' }}>
                                            <div className="d-flex justify-content-between align-items-center px-2 py-1 border-bottom bg-light">
                                                <span className="small fw-bold text-muted">{c.room || `Committee ${commIdx + 1}`}</span>
                                                <span className="d-inline-flex align-items-center gap-1">
                                                    <span className="small text-muted">theses</span>
                                                    <Badge bg="primary">{c.thesisIds?.length || 0}</Badge>
                                                </span>
                                            </div>
                                            <div className="d-flex align-items-center gap-1 px-2 py-2 border-bottom" style={{ backgroundColor: '#f0fdf4' }}>
                                                <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, minWidth: '24px' }}>SV</span>
                                                <span className="fw-bold text-success text-truncate" title={c.principal?.name} style={{ fontSize: '0.9rem' }}>{c.principal?.name || '—'}</span>
                                            </div>
                                            <div className="border-bottom">
                                                <ProfessorDropdown
                                                    label="M2"
                                                    bg="#eff6ff"
                                                    color="#1d4ed8"
                                                    value={c.examinator}
                                                    profs={professors}
                                                    onSelect={(pid) => quickSwapMember(dayIdx, sessIdx, commIdx, 'examinator', pid)}
                                                />
                                            </div>
                                            <div>
                                                <ProfessorDropdown
                                                    label="M3"
                                                    bg="#faf5ff"
                                                    color="#7c3aed"
                                                    value={c.supervisor}
                                                    profs={professors}
                                                    onSelect={(pid) => quickSwapMember(dayIdx, sessIdx, commIdx, 'supervisor', pid)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </Card.Body>
                </Card>
            ))}
        </Container>
    );
};

export default ManualPlanning;
