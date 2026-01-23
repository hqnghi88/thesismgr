import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Dashboard.css";

const Planning = () => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [professors, setProfessors] = useState([]);
    const [editForm, setEditForm] = useState({
        principal: '',
        examinator: '',
        supervisor: '',
        startTime: '',
        endTime: '',
        room: ''
    });
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
    };

    const handleUpdateSchedule = async (e) => {
        e.preventDefault();
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
            alert("Error updating schedule");
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

            const url = window.URL.createObjectURL(new Blob([res.data]));
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

    return (
        <div className="dashboard-container">
            <h2 className="dashboard-heading">Jury Planning</h2>

            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <button
                    onClick={handleAutoPlan}
                    disabled={loading}
                    style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                    {loading ? "Planning..." : "Run Auto-Planning"}
                </button>
                <button
                    onClick={handleExport}
                    style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                    📥 Export to Excel
                </button>
            </div>

            {editingSchedule && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '12px',
                        width: '90%',
                        maxWidth: '600px',
                        maxHeight: '90vh',
                        overflow: 'auto'
                    }}>
                        <h3 style={{ marginTop: 0 }}>Edit Schedule</h3>
                        <form onSubmit={handleUpdateSchedule}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Principal</label>
                                <select
                                    value={editForm.principal}
                                    onChange={(e) => setEditForm({ ...editForm, principal: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    required
                                >
                                    <option value="">Select Principal</option>
                                    {professors.map(prof => (
                                        <option key={prof._id} value={prof._id}>{prof.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Examinator</label>
                                <select
                                    value={editForm.examinator}
                                    onChange={(e) => setEditForm({ ...editForm, examinator: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    required
                                >
                                    <option value="">Select Examinator</option>
                                    {professors.map(prof => (
                                        <option key={prof._id} value={prof._id}>{prof.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Supervisor</label>
                                <select
                                    value={editForm.supervisor}
                                    onChange={(e) => setEditForm({ ...editForm, supervisor: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    required
                                >
                                    <option value="">Select Supervisor</option>
                                    {professors.map(prof => (
                                        <option key={prof._id} value={prof._id}>{prof.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Start Time</label>
                                <input
                                    type="datetime-local"
                                    value={editForm.startTime}
                                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>End Time</label>
                                <input
                                    type="datetime-local"
                                    value={editForm.endTime}
                                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Room</label>
                                <input
                                    type="text"
                                    value={editForm.room}
                                    onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    type="submit"
                                    style={{ flex: 1, padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                    Update Schedule
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    style={{ flex: 1, padding: '10px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="tasks-container">
                {schedules.map((schedule) => (
                    <div key={schedule._id} className="task-card" style={{ borderLeftColor: '#10b981' }}>
                        <div className="task-title">📅 {schedule.thesis?.title || "Untitled Thesis"}</div>
                        <div className="task-desc">
                            <strong>Room:</strong> {schedule.room}<br />
                            <strong>Time:</strong> {new Date(schedule.startTime).toLocaleString()} - {new Date(schedule.endTime).toLocaleTimeString()}
                        </div>
                        <div className="task-meta">
                            <strong>Jury Composition:</strong>
                            <ul style={{ listStyleType: 'none', paddingLeft: '10px' }}>
                                <li>👤 <strong>Student:</strong> {schedule.student?.name}</li>
                                <li>👨‍🏫 <strong>Supervisor:</strong> {schedule.supervisor?.name}</li>
                                <li>🎯 <strong>Principal:</strong> {schedule.principal?.name}</li>
                                <li>🔍 <strong>Examinator:</strong> {schedule.examinator?.name}</li>
                            </ul>
                        </div>
                        <div style={{ marginTop: '10px', textAlign: 'right', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => handleEdit(schedule)}
                                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                ✏️ Edit
                            </button>
                            <button
                                onClick={() => handleDelete(schedule._id)}
                                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                🗑️ Remove Schedule
                            </button>
                        </div>
                    </div>
                ))}

                {schedules.length === 0 && <p>No schedules planned yet.</p>}
            </div>
        </div>
    );
};

export default Planning;
