import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Button, Form, Alert, Badge, Dropdown } from "react-bootstrap";
import { useNotification } from "../context/NotificationContext";
import { useSemester } from "../context/SemesterContext";

const DEFAULT_ROOMS = ["Room 110/DI", "Room 111/DI", "Room 112/DI", "Room 113/DI"];

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

const CommitteeCard = ({ c, dayIdx, sessIdx, commIdx, professors, onSwap, onCardClick, isMoving }) => (
    <div
        className={`border rounded shadow-sm bg-white overflow-hidden ${isMoving ? 'border-danger animate-pulse' : ''}`}
        style={{ width: '280px', cursor: 'pointer' }}
        onClick={() => onCardClick(dayIdx, sessIdx, commIdx)}
    >
        <div className="d-flex justify-content-between align-items-center px-2 py-1 border-bottom bg-light">
            <span className="small fw-bold text-muted">{c.room || `Committee ${commIdx + 1}`}</span>
            <span className="d-inline-flex align-items-center gap-1">
                <Badge bg="secondary">{c.courseCode || 'No code'}</Badge>
                <Badge bg="primary">{c.thesisIds?.length || 0}</Badge>
            </span>
        </div>
        <div className="d-flex align-items-center gap-1 px-2 py-2 border-bottom" style={{ backgroundColor: '#f0fdf4' }}>
            <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, minWidth: '24px' }}>SV</span>
            <span className="fw-bold text-success text-truncate" title={c.principal?.name} style={{ fontSize: '0.9rem' }}>{c.principal?.name || '—'}</span>
        </div>
        <div className="border-bottom" onClick={(e) => e.stopPropagation()}>
            <ProfessorDropdown
                label="M2"
                bg="#eff6ff"
                color="#1d4ed8"
                value={c.examinator}
                profs={professors}
                onSelect={(pid) => onSwap(dayIdx, sessIdx, commIdx, 'examinator', pid)}
            />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
            <ProfessorDropdown
                label="M3"
                bg="#faf5ff"
                color="#7c3aed"
                value={c.supervisor}
                profs={professors}
                onSelect={(pid) => onSwap(dayIdx, sessIdx, commIdx, 'supervisor', pid)}
            />
        </div>
        {isMoving && (
            <div className="text-center bg-danger text-white small fw-bold py-1">PICKED UP</div>
        )}
    </div>
);

const ManualPlanning = () => {
    const { notify, confirm } = useNotification();
    const { activeSemester } = useSemester();
    const token = localStorage.getItem("token");

    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [professors, setProfessors] = useState([]);
    const [movingRef, setMovingRef] = useState(null);
    const [controls, setControls] = useState({
        startDate: new Date().toISOString().slice(0, 10),
        capacity: 6,
        roomCount: 3,
        sessionsPerDay: 2,
    });

    const fetchPlan = async () => {
        if (!activeSemester?._id) return;
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/manual-plan`, {
                params: { semester: activeSemester._id },
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
        fetchProfessors();
    }, []);

    useEffect(() => {
        setPlan(null);
        setMovingRef(null);
        fetchPlan();
    }, [activeSemester]);

    const savePlan = async (days) => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/manual-plan`, {
                semester: activeSemester._id,
                days,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchPlan();
        } catch (err) {
            notify(err.response?.data?.message || "Error updating plan");
            fetchPlan();
        }
    };

    const handleAutoPlan = async () => {
        if (!activeSemester?._id) return;
        if (!(await confirm(
            `Run manual auto-planning for ALL course codes in ${activeSemester.displayName}?\n\nIt will overwrite the current manual plan for this semester with one combined plan: theses grouped by course code and supervisor, committees of 3 professors (SV + M2 + M3) placed so no professor is double-booked in the same time slot.`,
            "Run Manual Planning"
        ))) return;

        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/manual-plan/auto-plan`, {
                semester: activeSemester._id,
                startDate: controls.startDate,
                capacity: controls.capacity,
                roomCount: controls.roomCount,
                sessionsPerDay: controls.sessionsPerDay,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPlan(res.data.plan);
            setMovingRef(null);
            notify(res.data.message + ` (${res.data.thesisCount} theses)`);
        } catch (err) {
            notify(err.response?.data?.message || "Error during manual planning");
        } finally {
            setLoading(false);
        }
    };

    const quickSwapMember = async (dayIdx, sessIdx, commIdx, role, newProfId) => {
        if (!plan || !activeSemester?._id) return;
        const days = plan.days.map((d, di) => ({
            ...d,
            sessions: d.sessions.map((s, si) => ({
                ...s,
                committees: s.committees.map((c, ci) => (di === dayIdx && si === sessIdx && ci === commIdx
                    ? { ...c, [role]: professors.find(p => p._id === newProfId) || c[role] }
                    : c)),
            })),
        }));
        setPlan({ ...plan, days });
        savePlan(days);
    };

    // Click-to-move/swap, mirroring the timetable: click a committee to pick it
    // up, click another committee to swap their slots, or click an empty slot to
    // move it there.
    const handleSlotClick = (dayIdx, sessIdx, commIdx) => {
        if (!plan || !activeSemester?._id) return;
        if (!movingRef) {
            if (commIdx !== null) setMovingRef({ dayIdx, sessIdx, commIdx });
            return;
        }
        if (movingRef.dayIdx === dayIdx && movingRef.sessIdx === sessIdx && movingRef.commIdx === commIdx) {
            setMovingRef(null);
            return;
        }

        const days = plan.days.map(d => ({
            ...d,
            sessions: d.sessions.map(s => ({ ...s, committees: s.committees.map(c => ({ ...c })) })),
        }));
        const srcSess = days[movingRef.dayIdx].sessions[movingRef.sessIdx];
        const srcComm = srcSess.committees[movingRef.commIdx];

        if (commIdx !== null) {
            const dstSess = days[dayIdx].sessions[sessIdx];
            const dstComm = dstSess.committees[commIdx];
            const srcRoom = srcComm.room;
            srcComm.room = dstComm.room;
            dstComm.room = srcRoom;
            dstSess.committees[commIdx] = srcComm;
            srcSess.committees[movingRef.commIdx] = dstComm;
        } else {
            const dstSess = days[dayIdx].sessions[sessIdx];
            srcSess.committees.splice(movingRef.commIdx, 1);
            srcComm.room = DEFAULT_ROOMS[dstSess.committees.length] || `Room ${dstSess.committees.length + 1}`;
            dstSess.committees.push(srcComm);
        }

        setPlan({ ...plan, days });
        setMovingRef(null);
        savePlan(days);
    };

    const handleClear = async () => {
        if (!activeSemester?._id) return;
        if (!(await confirm(
            `Delete the manual plan for ${activeSemester.displayName}?`,
            "Delete Manual Plan"
        ))) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/manual-plan`, {
                params: { semester: activeSemester._id },
                headers: { Authorization: `Bearer ${token}` },
            });
            setPlan(null);
            setMovingRef(null);
            notify("Manual plan deleted");
        } catch (err) {
            notify(err.response?.data?.message || "Error deleting manual plan");
        }
    };

    const handleExport = async () => {
        if (!activeSemester?._id || !plan) return;
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/manual-plan/export`, {
                params: { semester: activeSemester._id },
                headers: { Authorization: `Bearer ${token}` },
                responseType: "blob",
            });
            const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Xep lich LVTN ${activeSemester.displayName}.xlsx`);
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

    // Index committees by course code, keeping their position in plan.days.
    const courseSections = {};
    if (plan) {
        plan.days.forEach((day, dayIdx) => day.sessions.forEach((sess, sessIdx) => sess.committees.forEach((c, commIdx) => {
            const code = c.courseCode || "No code";
            if (!courseSections[code]) courseSections[code] = [];
            courseSections[code].push({ dayIdx, sessIdx, commIdx, day, sess, c });
        })));
    }
    const courseCodes = Object.keys(courseSections).sort();
    const maxPerSession = plan ? plan.days.reduce((mx, d) => d.sessions.reduce((m, s) => Math.max(m, s.committees.length), mx), 1) : 1;

    return (
        <Container fluid className="py-4">
            <Card className="border-0 shadow-sm mb-4">
                <Card.Body>
                    <h5 className="fw-bold mb-3">Manual Planning</h5>
                    <p className="text-muted mb-3 small">
                        Build <b>one plan for all course codes</b> in the active semester. Each committee is headed by the
                        <b> thesis supervisor</b> (SV) with their own theses, plus 2 other members (M2, M3). Committees are
                        placed across Sang/Chieu sessions so no professor is double-booked in the same time slot, even
                        across different courses. Results are shown split per course code.
                    </p>
                    <Row className="g-3 mb-2">
                        <Col md={4} sm={6}>
                            <Form.Label className="fw-semibold small mb-1">Start Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={controls.startDate}
                                onChange={(e) => setControls({ ...controls, startDate: e.target.value })}
                            />
                        </Col>
                        <Col md={3} sm={6}>
                            <Form.Label className="fw-semibold small mb-1">Theses per Committee</Form.Label>
                            <Form.Control
                                type="number"
                                min="1"
                                max="14"
                                value={controls.capacity}
                                onChange={(e) => setControls({ ...controls, capacity: parseInt(e.target.value) || 1 })}
                            />
                        </Col>
                        <Col md={2} sm={6}>
                            <Form.Label className="fw-semibold small mb-1">Committees per Session</Form.Label>
                            <Form.Select
                                value={controls.roomCount}
                                onChange={(e) => setControls({ ...controls, roomCount: parseInt(e.target.value) })}
                            >
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                            </Form.Select>
                        </Col>
                        <Col md={3} sm={6} className="d-flex align-items-end">
                            <Button variant="success" className="w-100" onClick={handleAutoPlan} disabled={loading || !activeSemester}>
                                {loading ? "Planning..." : "✨ Run Auto-Planning"}
                            </Button>
                        </Col>
                    </Row>
                    <Row className="g-3 mb-3">
                        <Col md={4} sm={6}>
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
                        <div className="d-flex gap-2 flex-wrap align-items-center">
                            <Badge bg="secondary">{courseCodes.length} course(s)</Badge>
                            <Badge bg="secondary">{totalTheses} theses planned</Badge>
                            <Button variant="outline-primary" size="sm" onClick={handleExport}>📥 Export Excel</Button>
                            <Button variant="outline-danger" size="sm" onClick={handleClear}>🗑 Delete Plan</Button>
                            {movingRef && (
                                <Button variant="outline-warning" size="sm" onClick={() => setMovingRef(null)}>✖ Cancel Move</Button>
                            )}
                        </div>
                    )}
                    {plan && (
                        <p className="text-muted small mt-3 mb-0">
                            💡 Click a committee to pick it up, then click <b>another committee to swap</b> slots or an
                            <b> empty slot to move</b> it there.
                        </p>
                    )}
                </Card.Body>
            </Card>

            {loading && <Alert variant="info">Generating manual plan for all course codes...</Alert>}

            {!plan && !loading && (
                <Card className="border-0 shadow-sm">
                    <Card.Body className="text-center text-muted py-5">
                        <div className="fs-1 mb-3">🗓️</div>
                        <h5>No manual plan for this semester yet</h5>
                        <p className="mb-0">Set the options above and click <b>Run Auto-Planning</b> to build one plan for all course codes.</p>
                    </Card.Body>
                </Card>
            )}

            {plan && courseCodes.map(code => {
                const items = courseSections[code];
                // Group items by date + session to preserve the day structure.
                const slots = [];
                items.forEach(item => {
                    const key = `${dateLabel(item.day.date)}|${item.sess.session}`;
                    const found = slots.find(s => s.key === key);
                    if (found) found.items.push(item);
                    else slots.push({ key, label: dateLabel(item.day.date), session: item.sess.session, dayIdx: item.dayIdx, sessIdx: item.sessIdx, items: [item] });
                });
                return (
                    <Card key={code} className="border-0 shadow-sm mb-4">
                        <Card.Header className="bg-white fw-bold text-secondary border-bottom d-flex justify-content-between align-items-center">
                            <span>📚 Course {code}</span>
                            <Badge bg="primary">{items.reduce((s, i) => s + (i.c.thesisIds?.length || 0), 0)} theses</Badge>
                        </Card.Header>
                        <Card.Body>
                            {slots.map(slot => (
                                <div key={slot.key} className="mb-4">
                                    <h6 className={`fw-bold mb-2 ${slot.session === "Sang" ? "text-primary" : "text-warning"}`}>
                                        🗓️ Ngay {slot.label} · {slot.session}
                                    </h6>
                                    <div className="d-flex flex-wrap gap-3">
                                        {slot.items.map(item => (
                                            <CommitteeCard
                                                key={item.c._id || item.commIdx}
                                                c={item.c}
                                                dayIdx={item.dayIdx}
                                                sessIdx={item.sessIdx}
                                                commIdx={item.commIdx}
                                                professors={professors}
                                                onSwap={quickSwapMember}
                                                onCardClick={handleSlotClick}
                                                isMoving={movingRef && movingRef.dayIdx === item.dayIdx && movingRef.sessIdx === item.sessIdx && movingRef.commIdx === item.commIdx}
                                            />
                                        ))}
                                        {Array.from({ length: Math.max(0, maxPerSession - slot.items.length) }).map((_, i) => (
                                            <div
                                                key={`empty-${i}`}
                                                className={`border rounded d-flex align-items-center justify-content-center ${movingRef ? 'border-success text-success' : 'border-secondary text-muted'}`}
                                                style={{ width: '280px', minHeight: '168px', cursor: 'pointer', borderStyle: 'dashed', background: movingRef ? '#f0fdf4' : '#f8f9fa' }}
                                                onClick={() => handleSlotClick(slot.dayIdx, slot.sessIdx, null)}
                                            >
                                                {movingRef ? <span className="fw-bold small">CLICK TO MOVE HERE</span> : <span className="small">empty slot</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </Card.Body>
                    </Card>
                );
            })}
        </Container>
    );
};

export default ManualPlanning;
