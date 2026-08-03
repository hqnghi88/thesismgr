import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Button, Form, Alert, Badge, Dropdown, Table } from "react-bootstrap";
import { useNotification } from "../context/NotificationContext";
import { useSemester } from "../context/SemesterContext";

const DEFAULT_ROOMS = ["Room 110/DI", "Room 111/DI", "Room 112/DI", "Room 113/DI"];

const TIME_SLOTS = {
    Sang: ['07h15', '07h50', '08h25', '09h00', '09h35', '10h10'],
    Chieu: ['13h30', '14h05', '14h40', '15h15', '15h50', '16h25'],
};
const DOW_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const lastName = (n) => { if (!n) return '—'; const p = n.trim().split(/\s+/); return p[p.length - 1]; };
const roomNum = (r) => parseInt((r || '').match(/(\d+)/)?.[1] || '999');

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
    const [movingRef, setMovingRef] = useState(null);
    const [editingCell, setEditingCell] = useState(null);
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

    const savePlan = async (days, unassigned, skipFetch) => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/manual-plan`, {
                semester: activeSemester._id,
                days,
                unassignedThesisIds: unassigned ?? plan?.unassignedThesisIds ?? [],
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!skipFetch) fetchPlan();
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

    // Minus: split 1 thesis off into a new committee in the same room
    const handleThesisSplit = (dayIdx, sessIdx, commIdx) => {
        if (!plan) return;
        const days = plan.days.map(d => ({
            ...d,
            sessions: d.sessions.map(s => ({ ...s, committees: s.committees.map(c => ({ ...c })) })),
        }));
        const sess = days[dayIdx].sessions[sessIdx];
        const comm = sess.committees[commIdx];
        if (!comm.thesisIds || comm.thesisIds.length === 0) return;

        // Pop the last thesis from this committee
        const splitThesis = comm.thesisIds.pop();

        // Create a new committee with that 1 thesis, same room, same course
        const newComm = {
            room: comm.room,
            courseCode: comm.courseCode,
            principal: comm.principal,
            examinator: comm.examinator,
            supervisor: comm.supervisor,
            thesisIds: [splitThesis],
        };

        // Insert new committee into the session
        sess.committees.push(newComm);

        setPlan({ ...plan, days });
        savePlan(days, undefined, true);
    };

    const handleReturnAllToPool = null; // removed — pool concept dropped

    // Shift+click merge: merge source into target (combine theses, keep target's room/members)
    const handleMerge = (dayIdx, sessIdx, commIdx) => {
        if (!plan || !movingRef || !activeSemester?._id) return;
        const days = plan.days.map(d => ({
            ...d,
            sessions: d.sessions.map(s => ({ ...s, committees: s.committees.map(c => ({ ...c })) })),
        }));
        const srcSess = days[movingRef.dayIdx].sessions[movingRef.sessIdx];
        const srcComm = srcSess.committees[movingRef.commIdx];
        const dstSess = days[dayIdx].sessions[sessIdx];
        const dstComm = dstSess.committees[commIdx];

        // Merge: combine thesisIds into target, remove source
        dstComm.thesisIds = [...(dstComm.thesisIds || []), ...(srcComm.thesisIds || [])];
        srcSess.committees.splice(movingRef.commIdx, 1);

        setPlan({ ...plan, days });
        setMovingRef(null);
        setEditingCell(null);
        savePlan(days);
    };

    // Click-to-move/swap: click a committee to pick it up, click another
    // committee to swap, or click an empty cell to move the committee there.
    // `targetRoom` is the room of the clicked cell (from the grid).
    const handleSlotClick = (dayIdx, sessIdx, commIdx, targetRoom, targetSlotIdx) => {
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
        const dstSess = days[dayIdx].sessions[sessIdx];

        if (commIdx !== null) {
            // Swapping with another committee
            const dstComm = dstSess.committees[commIdx];

            if (srcSess === dstSess && srcComm.room !== dstComm.room) {
                // Same session, different rooms: rebuild array so each committee
                // lands at the other's original slot within its new room.
                const byRoom = {};
                dstSess.committees.forEach((c, i) => {
                    const r = c.room || 'Unknown';
                    if (!byRoom[r]) byRoom[r] = [];
                    byRoom[r].push({ c, idx: i });
                });
                const srcOrigSlot = byRoom[srcComm.room]?.findIndex(e => e.idx === movingRef.commIdx) ?? 0;
                const dstOrigSlot = byRoom[dstComm.room]?.findIndex(e => e.idx === commIdx) ?? 0;

                const origSrcRoom = srcComm.room;
                srcComm.room = dstComm.room;
                dstComm.room = origSrcRoom;

                const remaining = dstSess.committees.filter((_, i) => i !== movingRef.commIdx && i !== commIdx);
                const newGroups = {};
                remaining.forEach(c => {
                    if (!newGroups[c.room]) newGroups[c.room] = [];
                    newGroups[c.room].push(c);
                });
                if (!newGroups[srcComm.room]) newGroups[srcComm.room] = [];
                if (!newGroups[dstComm.room]) newGroups[dstComm.room] = [];
                newGroups[srcComm.room].splice(dstOrigSlot, 0, srcComm);
                newGroups[dstComm.room].splice(srcOrigSlot, 0, dstComm);

                dstSess.committees = Object.keys(newGroups)
                    .sort((a, b) => roomNum(a) - roomNum(b))
                    .flatMap(r => newGroups[r]);
            } else {
                // Same room or different sessions: simple room+position swap
                const srcRoom = srcComm.room;
                srcComm.room = dstComm.room;
                dstComm.room = srcRoom;
                dstSess.committees[commIdx] = srcComm;
                srcSess.committees[movingRef.commIdx] = dstComm;
            }
        } else {
            // Move to empty slot — use the target room from the grid cell
            srcSess.committees.splice(movingRef.commIdx, 1);
            srcComm.room = targetRoom || srcComm.room;
            // Rebuild source session groups and insert at the correct slot
            const srcGroups = {};
            srcSess.committees.forEach(c => {
                if (!srcGroups[c.room]) srcGroups[c.room] = [];
                srcGroups[c.room].push(c);
            });
            if (!srcGroups[srcComm.room]) srcGroups[srcComm.room] = [];
            const insAt = typeof targetSlotIdx === 'number' ? targetSlotIdx : srcGroups[srcComm.room].length;
            srcGroups[srcComm.room].splice(insAt, 0, srcComm);
            srcSess.committees = Object.keys(srcGroups)
                .sort((a, b) => roomNum(a) - roomNum(b))
                .flatMap(r => srcGroups[r]);
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
    const dropTargetCount = movingRef && plan ? plan.days.reduce((sum, d, di) => d.sessions.reduce((s, sess, si) => {
        if (di === movingRef.dayIdx && si === movingRef.sessIdx) return s;
        return s + Math.max(0, maxPerSession - sess.committees.length);
    }, sum), 0) : 0;
    const isSourceSession = (slot) => movingRef && slot.dayIdx === movingRef.dayIdx && slot.sessIdx === movingRef.sessIdx;

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
                        <>
                            <Button variant="outline-warning" size="sm" onClick={() => setMovingRef(null)}>✖ Cancel Move</Button>
                            {dropTargetCount === 0 && (
                                <Alert variant="warning" className="mb-0 small" style={{ padding: '0.4rem 0.75rem' }}>
                                    No empty slot in another session — click another committee's <b>✋ Move</b> to swap their slots instead.
                                </Alert>
                            )}
                            {dropTargetCount > 0 && (
                                <Alert variant="info" className="mb-0 small" style={{ padding: '0.4rem 0.75rem' }}>
                                    Click an <b>empty slot (CLICK TO MOVE HERE)</b> in another session to move the committee there, or click another committee's <b>✋ Move</b> to swap.
                                </Alert>
                            )}
                        </>
                    )}
                </div>
            )}
            {plan && (
                <p className="text-muted small mt-3 mb-0">
                    💡 Click a committee to pick it up, click another to swap, or click an empty slot to move.
                    Hold <b>Shift + click</b> to merge into target. Click the <b>thesis count number</b> to split.
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
                const dayMap = {};
                items.forEach(item => {
                    const dl = dateLabel(item.day.date);
                    if (!dayMap[dl]) dayMap[dl] = { dl, date: item.day.date, dayIdx: item.dayIdx };
                });
                const dayEntries = Object.values(dayMap).sort((a, b) => new Date(a.date) - new Date(b.date));
                const totalTh = items.reduce((s, i) => s + (i.c.thesisIds?.length || 0), 0);
                // Collect ALL rooms used across ALL courses in ALL days/sessions
                // so that empty rooms keep their columns visible (drop targets).
                const allCourseRooms = [...new Set(
                    plan.days.flatMap(d => d.sessions.flatMap(s => s.committees.map(c => c.room).filter(Boolean)))
                )].sort((a, b) => roomNum(a) - roomNum(b));
                return (
                    <Card key={code} className="border-0 shadow-sm mb-4">
                        <Card.Header className="bg-white fw-bold text-secondary border-bottom d-flex justify-content-between align-items-center">
                            <span>📚 Course {code}</span>
                            <Badge bg="primary">{totalTh} theses</Badge>
                        </Card.Header>
                        <Card.Body>
                            {dayEntries.map(dayEntry => {
                                const dow = DOW_LABELS[new Date(dayEntry.date).getDay()];
                                const day = plan.days[dayEntry.dayIdx];
                                return (
                                    <div key={dayEntry.dl} className="mb-3">
                                        <h6 className="fw-bold text-secondary mb-2">📅 {dow} | {dayEntry.dl}</h6>
                                        {day.sessions.map((sess, sessIdx) => {
                                            const sessName = sess.session || (sessIdx === 0 ? 'Sang' : 'Chieu');
                                            const courseComms = sess.committees
                                                .map((c, commIdx) => ({ c, commIdx }))
                                                .filter(({ c }) => (c.courseCode || 'No code') === code);
                                            if (courseComms.length === 0) return null;
                                            const byRoom = {};
                                            courseComms.forEach(({ c, commIdx }) => {
                                                const r = c.room || 'Unknown';
                                                if (!byRoom[r]) byRoom[r] = [];
                                                byRoom[r].push({ c, commIdx, dayIdx: dayEntry.dayIdx, sessIdx });
                                            });
                                            const rooms = allCourseRooms;
                                            const slots = TIME_SLOTS[sessName] || TIME_SLOTS.Sang;
                                            return (
                                                <div key={sessIdx} className="mb-2">
                                                    <div className={`fw-bold small mb-1 ${sessName === 'Sang' ? 'text-primary' : 'text-warning'}`}>{sessName}</div>
                                                    <Table bordered size="sm" className="align-middle mb-0" style={{ width: 'auto' }}>
                                                        <thead>
                                                            <tr>
                                                                <th rowSpan={2} className="text-center" style={{ width: '80px' }}>Thời gian</th>
                                                                {rooms.map(room => (
                                                                    <th key={room} colSpan={3} className="text-center bg-light" style={{ width: `${rooms.length > 1 ? 180 : 240}px` }}>{room}</th>
                                                                ))}
                                                            </tr>
                                                            <tr>
                                                                {rooms.map(room => (
                                                                    <React.Fragment key={`sub-${room}`}>
                                                                        <th className="text-center" style={{ color: '#16a34a', fontSize: '0.75rem' }}>GVHD</th>
                                                                        <th className="text-center" style={{ color: '#1d4ed8', fontSize: '0.75rem' }}>UV</th>
                                                                        <th className="text-center" style={{ color: '#7c3aed', fontSize: '0.75rem' }}>CT</th>
                                                                    </React.Fragment>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {slots.map((time, slotIdx) => (
                                                                <tr key={slotIdx} style={{ minHeight: '32px' }}>
                                                                    <td className="text-center fw-bold text-muted small">{time}</td>
                                                                    {rooms.map(room => {
                                                                        const entry = byRoom[room]?.[slotIdx];
                                                                        if (!entry) {
                                                                            return (
                                                                                <React.Fragment key={`e-${room}-${slotIdx}`}>
                                                                                    <td className={`text-center small ${movingRef ? 'text-success' : ''}`}
                                                                                        style={{ cursor: movingRef ? 'pointer' : 'default', background: movingRef ? '#f0fdf4' : undefined, minWidth: '60px' }}
                                                                                        onClick={() => movingRef && handleSlotClick(dayEntry.dayIdx, sessIdx, null, room, slotIdx)}>
                                                                                        {movingRef && slotIdx === 0 ? <span className="fw-bold">CLICK</span> : ''}
                                                                                    </td>
                                                                                    <td className={`text-center small ${movingRef ? 'text-success' : ''}`}
                                                                                        style={{ cursor: movingRef ? 'pointer' : 'default', background: movingRef ? '#f0fdf4' : undefined, minWidth: '60px' }}
                                                                                        onClick={() => movingRef && handleSlotClick(dayEntry.dayIdx, sessIdx, null, room, slotIdx)}>
                                                                                    </td>
                                                                                    <td className={`text-center small ${movingRef ? 'text-success' : ''}`}
                                                                                        style={{ cursor: movingRef ? 'pointer' : 'default', background: movingRef ? '#f0fdf4' : undefined, minWidth: '60px' }}
                                                                                        onClick={() => movingRef && handleSlotClick(dayEntry.dayIdx, sessIdx, null, room, slotIdx)}>
                                                                                    </td>
                                                                                </React.Fragment>
                                                                            );
                                                                        }
                                                                        const { c, commIdx, dayIdx, sessIdx: si } = entry;
                                                                        const isMoving = movingRef &&
                                                                            movingRef.dayIdx === dayIdx && movingRef.sessIdx === si && movingRef.commIdx === commIdx;
                                                                        const cellBg = isMoving ? '#fff5f5' : undefined;
                                                                        const cellStyle = { cursor: 'pointer', background: cellBg };
                                                                        const isEditing = editingCell &&
                                                                            editingCell.dayIdx === dayIdx && editingCell.sessIdx === si && editingCell.commIdx === commIdx;
                                                                        const handleCellClick = (e) => {
                                                                            if (movingRef && e.shiftKey) {
                                                                                e.stopPropagation();
                                                                                handleMerge(dayIdx, si, commIdx);
                                                                                return;
                                                                            }
                                                                            handleSlotClick(dayIdx, si, commIdx);
                                                                        };
                                                                        return (
                                                                            <React.Fragment key={`c-${room}-${slotIdx}`}>
                                                                                <td style={cellStyle} onClick={handleCellClick} className="position-relative">
                                                                                    <span
                                                                                        className="fw-bold"
                                                                                        style={{ textDecoration: 'underline', cursor: 'pointer' }}
                                                                                        onClick={(e) => { e.stopPropagation(); setEditingCell(isEditing ? null : { dayIdx, sessIdx: si, commIdx }); }}
                                                                                    >{c.thesisIds?.length || 0}</span>{' '}
                                                                                    <span className="text-danger fw-bold">{lastName(c.principal?.name)}</span>
                                                                                    {isMoving && <span className="ms-1">✋</span>}
                                                                                    {isEditing && (
                                                                                        <div
                                                                                            className="position-absolute bg-white border rounded shadow-sm p-2"
                                                                                            style={{ zIndex: 1050, top: '100%', left: 0, minWidth: '160px' }}
                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                        >
                                                                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                                                                <span className="fw-bold">{c.thesisIds?.length || 0} theses</span>
                                                                                            </div>
                                                                                            {(c.thesisIds?.length || 0) > 1 && (
                                                                                                <Button size="sm" variant="outline-danger" className="w-100"
                                                                                                    onClick={() => { handleThesisSplit(dayIdx, si, commIdx); }}>
                                                                                                    Split off 1 → new committee
                                                                                                </Button>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </td>
                                                                                <td style={cellStyle} onClick={handleCellClick}>
                                                                                    <div onClick={(e) => e.stopPropagation()}>
                                                                                    <ProfessorDropdown
                                                                                        profs={professors}
                                                                                        value={c.examinator}
                                                                                        label="UV"
                                                                                        bg="#eff6ff"
                                                                                        color="#1d4ed8"
                                                                                        onSelect={(id) => quickSwapMember(dayIdx, si, commIdx, 'examinator', id)}
                                                                                    />
                                                                                    </div>
                                                                                </td>
                                                                                <td style={cellStyle} onClick={handleCellClick}>
                                                                                    <div onClick={(e) => e.stopPropagation()}>
                                                                                    <ProfessorDropdown
                                                                                        profs={professors}
                                                                                        value={c.supervisor}
                                                                                        label="CT"
                                                                                        bg="#f5f3ff"
                                                                                        color="#7c3aed"
                                                                                        onSelect={(id) => quickSwapMember(dayIdx, si, commIdx, 'supervisor', id)}
                                                                                    />
                                                                                    </div>
                                                                                </td>
                                                                            </React.Fragment>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </Card.Body>
                    </Card>
                );
            })}
        </Container>
    );
};

export default ManualPlanning;
