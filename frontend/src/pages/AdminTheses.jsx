import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Dashboard.css";

const AdminTheses = () => {
    const [theses, setTheses] = useState([]);
    const [professors, setProfessors] = useState([]);
    const [importing, setImporting] = useState(false);
    const token = localStorage.getItem("token");

    const fetchData = async () => {
        try {
            const [thesisRes, profRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/admin/theses`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/professors`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setTheses(thesisRes.data);
            setProfessors(profRes.data);
        } catch (err) {
            console.error("Fetch data error:", err.response?.data || err.message);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setImporting(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/import-excel`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
            });
            alert(res.data.message + ": " + res.data.count + " records created.");
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || "Import failed");
        } finally {
            setImporting(false);
        }
    };


    const handleUpdate = async (thesisId, updates) => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/theses/${thesisId}`,
                updates,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchData();
        } catch (err) {
            alert("Error updating thesis");
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="dashboard-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="dashboard-heading" style={{ margin: 0 }}>All Theses (Admin Console)</h2>
                <div>
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        style={{ display: 'none' }}
                        id="excel-upload"
                        onChange={handleImport}
                        disabled={importing}
                    />
                    <label
                        htmlFor="excel-upload"
                        style={{
                            background: '#10b981',
                            color: 'white',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            cursor: importing ? 'not-allowed' : 'pointer',
                            opacity: importing ? 0.7 : 1
                        }}
                    >
                        {importing ? "Importing..." : "📥 Import from Excel"}
                    </label>
                </div>
            </div>


            <div className="tasks-container">
                {theses.map((thesis) => (
                    <div key={thesis._id} className="task-card">
                        <div className="task-title" style={{ justifyContent: 'space-between' }}>
                            <span>🎓 {thesis.title}</span>
                            <span className={`task-status ${thesis.status}`} style={{ margin: 0 }}>
                                {thesis.status.replace('_', ' ')}
                            </span>
                        </div>

                        <p className="task-desc">{thesis.abstract}</p>

                        <div className="task-meta">
                            <strong>Student:</strong> {thesis.student?.name} ({thesis.student?.email})<br />
                            <strong>Current Supervisor:</strong> {thesis.supervisor?.name || "Not assigned"}
                        </div>

                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <label>Update Status:</label>
                            <select
                                value={thesis.status}
                                onChange={(e) => handleUpdate(thesis._id, { status: e.target.value })}
                                style={{ padding: '6px', borderRadius: '4px' }}
                            >
                                <option value="submitted">Submitted</option>
                                <option value="under_review">Under Review</option>
                                <option value="approved">Approved</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="completed">Completed</option>
                            </select>

                            <label style={{ marginLeft: '10px' }}>Reassign Supervisor:</label>
                            <select
                                value={thesis.supervisor?._id || ""}
                                onChange={(e) => handleUpdate(thesis._id, { supervisor: e.target.value })}
                                style={{ padding: '6px', borderRadius: '4px' }}
                            >
                                <option value="">Select Professor</option>
                                {professors.map(p => (
                                    <option key={p._id} value={p._id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ))}
                {theses.length === 0 && <p>No theses submitted yet.</p>}
            </div>
        </div>
    );
};

export default AdminTheses;
