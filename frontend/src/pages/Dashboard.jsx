import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalTheses: 0,
        pendingTheses: 0,
        approvedTheses: 0,
        scheduledTheses: 0,
        totalSchedules: 0,
        totalUsers: 0
    });
    const [recentTheses, setRecentTheses] = useState([]);
    const [upcomingSchedules, setUpcomingSchedules] = useState([]);
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const navigate = useNavigate();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            // Fetch theses
            const thesesRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/theses`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const theses = thesesRes.data;

            // Fetch schedules
            const schedulesRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/schedules`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const schedules = schedulesRes.data;

            // Calculate stats
            setStats({
                totalTheses: theses.length,
                pendingTheses: theses.filter(t => t.status === 'pending').length,
                approvedTheses: theses.filter(t => t.status === 'approved').length,
                scheduledTheses: theses.filter(t => t.status === 'scheduled').length,
                totalSchedules: schedules.length,
                totalUsers: 0 // Will be populated if admin
            });

            // Recent theses (last 5)
            setRecentTheses(theses.slice(-5).reverse());

            // Upcoming schedules (next 5)
            const upcoming = schedules
                .filter(s => new Date(s.startTime) > new Date())
                .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
                .slice(0, 5);
            setUpcomingSchedules(upcoming);

            // Fetch user count if admin
            if (user.role === 'admin') {
                const usersRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(prev => ({ ...prev, totalUsers: usersRes.data.length }));
            }
        } catch (err) {
            console.error("Dashboard fetch error:", err);
        }
    };

    return (
        <div className="dashboard-container">
            <h2 className="dashboard-heading">📊 Dashboard</h2>
            <p style={{ color: '#6b7280', marginBottom: '30px' }}>
                Welcome back, <strong>{user.name}</strong>! Here's an overview of your thesis management system.
            </p>

            {/* Statistics Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px',
                marginBottom: '30px'
            }}>
                <div className="stat-card" style={{ backgroundColor: '#eff6ff', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>{stats.totalTheses}</div>
                    <div style={{ color: '#6b7280', marginTop: '5px' }}>Total Theses</div>
                </div>
                <div className="stat-card" style={{ backgroundColor: '#fef3c7', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.pendingTheses}</div>
                    <div style={{ color: '#6b7280', marginTop: '5px' }}>Pending Review</div>
                </div>
                <div className="stat-card" style={{ backgroundColor: '#d1fae5', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>{stats.approvedTheses}</div>
                    <div style={{ color: '#6b7280', marginTop: '5px' }}>Approved</div>
                </div>
                <div className="stat-card" style={{ backgroundColor: '#e0e7ff', borderLeft: '4px solid #6366f1' }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#6366f1' }}>{stats.scheduledTheses}</div>
                    <div style={{ color: '#6b7280', marginTop: '5px' }}>Scheduled</div>
                </div>
                {user.role === 'admin' && (
                    <div className="stat-card" style={{ backgroundColor: '#fce7f3', borderLeft: '4px solid #ec4899' }}>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ec4899' }}>{stats.totalUsers}</div>
                        <div style={{ color: '#6b7280', marginTop: '5px' }}>Total Users</div>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '15px' }}>Quick Actions</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate('/theses')}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#4f46e5',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        📝 Manage Theses
                    </button>
                    <button
                        onClick={() => navigate('/planning')}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        📅 View Planning
                    </button>
                    {user.role === 'admin' && (
                        <>
                            <button
                                onClick={() => navigate('/admin/users')}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#ec4899',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                👥 Manage Users
                            </button>
                            <button
                                onClick={() => navigate('/admin/theses')}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                🎓 All Theses
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Recent Activity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                {/* Recent Theses */}
                <div>
                    <h3 style={{ marginBottom: '15px' }}>Recent Theses</h3>
                    <div className="tasks-container">
                        {recentTheses.length > 0 ? recentTheses.map(thesis => (
                            <div key={thesis._id} className="task-card" style={{ marginBottom: '10px' }}>
                                <div className="task-title" style={{ fontSize: '14px' }}>🎓 {thesis.title}</div>
                                <div className={`task-status ${thesis.status}`} style={{ fontSize: '12px' }}>
                                    {thesis.status.replace('_', ' ')}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                                    Student: {thesis.student?.name}
                                </div>
                            </div>
                        )) : <p style={{ color: '#6b7280' }}>No theses yet</p>}
                    </div>
                </div>

                {/* Upcoming Schedules */}
                <div>
                    <h3 style={{ marginBottom: '15px' }}>Upcoming Defenses</h3>
                    <div className="tasks-container">
                        {upcomingSchedules.length > 0 ? upcomingSchedules.map(schedule => (
                            <div key={schedule._id} className="task-card" style={{ marginBottom: '10px', borderLeftColor: '#10b981' }}>
                                <div className="task-title" style={{ fontSize: '14px' }}>📅 {schedule.thesis?.title}</div>
                                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                                    <strong>Time:</strong> {new Date(schedule.startTime).toLocaleString()}<br />
                                    <strong>Room:</strong> {schedule.room}
                                </div>
                            </div>
                        )) : <p style={{ color: '#6b7280' }}>No upcoming defenses</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
