import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Dashboard.css";

const Planning = () => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
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

    useEffect(() => {
        fetchSchedules();
    }, []);

    return (
        <div className="dashboard-container">
            <h2 className="dashboard-heading">Jury Planning</h2>

            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={handleAutoPlan}
                    disabled={loading}
                    style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                    {loading ? "Planning..." : "Run Auto-Planning"}
                </button>
            </div>

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
                        <div style={{ marginTop: '10px', textAlign: 'right' }}>
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
