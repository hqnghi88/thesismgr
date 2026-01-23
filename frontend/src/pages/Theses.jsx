import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Dashboard.css";

const Theses = () => {
    const [theses, setTheses] = useState([]);
    const [form, setForm] = useState({ title: "", abstract: "", supervisor: "" });
    const [professors, setProfessors] = useState([]);
    const token = localStorage.getItem("token");

    const fetchTheses = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/theses`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setTheses(res.data);
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
            console.error("Fetch profs error:", err.response?.data || err.message);
        }
    };

    useEffect(() => {
        fetchTheses();
        fetchProfessors();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/theses`, form, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setForm({ title: "", abstract: "", supervisor: "" });
            fetchTheses();
        } catch (err) {
            console.error("error:", err.response?.data || err.message);
        }
    };

    const handleDelete = async (thesisId) => {
        if (!window.confirm("Are you sure you want to delete this thesis?")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/theses/${thesisId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTheses();
        } catch (err) {
            alert("Error deleting thesis");
        }
    };


    return (
        <div className="dashboard-container">
            <h2 className="dashboard-heading">Thesis Management</h2>

            <form className="task-form" onSubmit={handleSubmit}>
                <div className="task-form-container">
                    <input
                        type="text"
                        className="task-input"
                        placeholder="Thesis Title"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        required
                    />
                    <textarea
                        className="task-textarea"
                        placeholder="Abstract"
                        value={form.abstract}
                        onChange={(e) => setForm({ ...form, abstract: e.target.value })}
                    />
                    <select
                        className="task-input"
                        value={form.supervisor}
                        onChange={(e) => setForm({ ...form, supervisor: e.target.value })}
                        required
                        style={{ padding: '10px', marginBottom: '10px', borderRadius: '6px' }}
                    >
                        <option value="">Select Supervisor</option>
                        {professors.map(prof => (
                            <option key={prof._id} value={prof._id}>{prof.name}</option>
                        ))}
                    </select>
                    <button style={{ backgroundColor: "#4f46e5" }} type="submit">Submit Thesis</button>
                </div>
            </form>


            <div className="tasks-container">
                {theses.map((thesis) => (
                    <div key={thesis._id} className="task-card">
                        <div className="task-title">🎓 {thesis.title}</div>
                        <div className={`task-status ${thesis.status}`}>
                            {thesis.status.replace('_', ' ')}
                        </div>
                        <p className="task-desc">{thesis.abstract}</p>
                        <div className="task-meta">
                            Student: {thesis.student?.name}<br />
                            Supervisor: {thesis.supervisor?.name}
                        </div>
                        <div style={{ marginTop: '10px', textAlign: 'right' }}>
                            <button
                                onClick={() => handleDelete(thesis._id)}
                                style={{
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default Theses;
