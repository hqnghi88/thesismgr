import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Button, Badge, ListGroup } from "react-bootstrap";

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
            const thesesRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/theses`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const theses = thesesRes.data;

            const schedulesRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/schedules`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const schedules = schedulesRes.data;

            setStats({
                totalTheses: theses.length,
                pendingTheses: theses.filter(t => t.status === 'pending').length,
                approvedTheses: theses.filter(t => t.status === 'approved').length,
                scheduledTheses: theses.filter(t => t.status === 'scheduled').length,
                totalSchedules: schedules.length,
                totalUsers: 0
            });

            setRecentTheses(theses.slice(-5).reverse());

            const upcoming = schedules
                .filter(s => new Date(s.startTime) > new Date())
                .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
                .slice(0, 5);
            setUpcomingSchedules(upcoming);

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

    const getStatusVariant = (status) => {
        switch (status) {
            case 'pending': return 'warning';
            case 'approved': return 'success';
            case 'scheduled': return 'info';
            default: return 'secondary';
        }
    };

    return (
        <Container fluid className="py-4" style={{ marginTop: '70px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            <Container>
                <h2 className="mb-1 fw-bold">📊 Dashboard</h2>
                <p className="text-muted mb-4">Welcome back, <strong>{user.name}</strong>! Here's an overview of your thesis management system.</p>

                {/* Statistics Cards */}
                <Row className="g-4 mb-4">
                    <Col md={6} lg={3}>
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 className="text-muted mb-2">Total Theses</h6>
                                        <h2 className="mb-0 fw-bold text-primary">{stats.totalTheses}</h2>
                                    </div>
                                    <div className="fs-1 text-primary opacity-25">📚</div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={6} lg={3}>
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 className="text-muted mb-2">Pending Review</h6>
                                        <h2 className="mb-0 fw-bold text-warning">{stats.pendingTheses}</h2>
                                    </div>
                                    <div className="fs-1 text-warning opacity-25">⏳</div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={6} lg={3}>
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 className="text-muted mb-2">Approved</h6>
                                        <h2 className="mb-0 fw-bold text-success">{stats.approvedTheses}</h2>
                                    </div>
                                    <div className="fs-1 text-success opacity-25">✅</div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={6} lg={3}>
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 className="text-muted mb-2">Scheduled</h6>
                                        <h2 className="mb-0 fw-bold text-info">{stats.scheduledTheses}</h2>
                                    </div>
                                    <div className="fs-1 text-info opacity-25">📅</div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                    {user.role === 'admin' && (
                        <Col md={6} lg={3}>
                            <Card className="border-0 shadow-sm h-100">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Total Users</h6>
                                            <h2 className="mb-0 fw-bold text-danger">{stats.totalUsers}</h2>
                                        </div>
                                        <div className="fs-1 text-danger opacity-25">👥</div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    )}
                </Row>

                {/* Quick Actions */}
                <Card className="border-0 shadow-sm mb-4">
                    <Card.Body>
                        <h5 className="mb-3 fw-bold">Quick Actions</h5>
                        <div className="d-flex flex-wrap gap-2">
                            <Button variant="primary" onClick={() => navigate('/theses')}>
                                📝 Manage Theses
                            </Button>
                            <Button variant="success" onClick={() => navigate('/planning')}>
                                📅 View Planning
                            </Button>
                            {user.role === 'admin' && (
                                <>
                                    <Button variant="danger" onClick={() => navigate('/admin/users')}>
                                        👥 Manage Users
                                    </Button>
                                    <Button variant="warning" onClick={() => navigate('/admin/theses')}>
                                        🎓 All Theses
                                    </Button>
                                </>
                            )}
                        </div>
                    </Card.Body>
                </Card>

                {/* Recent Activity */}
                <Row className="g-4">
                    <Col lg={6}>
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Header className="bg-white border-bottom">
                                <h5 className="mb-0 fw-bold">Recent Theses</h5>
                            </Card.Header>
                            <Card.Body className="p-0">
                                <ListGroup variant="flush">
                                    {recentTheses.length > 0 ? recentTheses.map(thesis => (
                                        <ListGroup.Item key={thesis._id}>
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div className="flex-grow-1">
                                                    <h6 className="mb-1">🎓 {thesis.title}</h6>
                                                    <small className="text-muted">Student: {thesis.student?.name}</small>
                                                </div>
                                                <Badge bg={getStatusVariant(thesis.status)}>
                                                    {thesis.status}
                                                </Badge>
                                            </div>
                                        </ListGroup.Item>
                                    )) : (
                                        <ListGroup.Item className="text-muted text-center py-4">
                                            No theses yet
                                        </ListGroup.Item>
                                    )}
                                </ListGroup>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col lg={6}>
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Header className="bg-white border-bottom">
                                <h5 className="mb-0 fw-bold">Upcoming Defenses</h5>
                            </Card.Header>
                            <Card.Body className="p-0">
                                <ListGroup variant="flush">
                                    {upcomingSchedules.length > 0 ? upcomingSchedules.map(schedule => (
                                        <ListGroup.Item key={schedule._id}>
                                            <h6 className="mb-1">📅 {schedule.thesis?.title}</h6>
                                            <small className="text-muted d-block">
                                                <strong>Time:</strong> {new Date(schedule.startTime).toLocaleString()}
                                            </small>
                                            <small className="text-muted">
                                                <strong>Room:</strong> {schedule.room}
                                            </small>
                                        </ListGroup.Item>
                                    )) : (
                                        <ListGroup.Item className="text-muted text-center py-4">
                                            No upcoming defenses
                                        </ListGroup.Item>
                                    )}
                                </ListGroup>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </Container>
    );
};

export default Dashboard;
