import React, { useState } from "react";
import axios from "axios";
import { Container, Card, Button, Alert, Row, Col, Form } from "react-bootstrap";
import { useNotification } from "../context/NotificationContext";

const AdminBackup = () => {
    const { notify, confirm } = useNotification();
    const [exporting, setExporting] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [backupFile, setBackupFile] = useState(null);
    const [restoreConfirm, setRestoreConfirm] = useState("");
    const token = localStorage.getItem("token");

    const handleDownload = async () => {
        setExporting(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/backup/download`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: "blob",
            });
            const blob = new Blob([res.data], { type: "application/json" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const date = new Date().toISOString().slice(0, 10);
            link.setAttribute("download", `thesismgr-backup-${date}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            notify("Backup downloaded successfully");
        } catch (err) {
            notify(err.response?.data?.message || "Backup failed");
        } finally {
            setExporting(false);
        }
    };

    const handleRestore = async () => {
        if (!backupFile) {
            notify("Please select a backup file first");
            return;
        }
        if (restoreConfirm !== "RESTORE") {
            notify('Type "RESTORE" to confirm');
            return;
        }
        if (!(await confirm("This will overwrite ALL existing data with the backup. Are you absolutely sure?"))) return;

        setRestoring(true);
        try {
            const formData = new FormData();
            formData.append("backup", backupFile);

            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/backup/restore`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            notify(`Restore complete: ${JSON.stringify(res.data.restored)}`);
            setBackupFile(null);
            setRestoreConfirm("");
        } catch (err) {
            notify(err.response?.data?.message || "Restore failed");
        } finally {
            setRestoring(false);
        }
    };

    return (
        <Container fluid className="py-4" style={{ marginTop: "70px", backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
            <Container>
                <h2 className="mb-4 fw-bold">Backup & Restore</h2>

                <Row className="g-4">
                    <Col lg={6}>
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body>
                                <h5 className="fw-bold mb-3">Download Backup</h5>
                                <p className="text-muted">
                                    Export all data (users, semesters, theses, schedules) as a JSON file.
                                    Keep this file safe — you can use it to restore your data later.
                                </p>
                                <Button variant="primary" onClick={handleDownload} disabled={exporting}>
                                    {exporting ? "Exporting..." : "Download Full Backup"}
                                </Button>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col lg={6}>
                        <Card className="border-0 shadow-sm h-100 border-danger">
                            <Card.Body>
                                <h5 className="fw-bold mb-3 text-danger">Restore Backup</h5>
                                <Alert variant="danger">
                                    <strong>Warning:</strong> Restore will overwrite ALL existing data (users, semesters, theses, schedules)
                                    with data from the backup file. This cannot be undone.
                                </Alert>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-semibold">Select Backup File</Form.Label>
                                    <Form.Control
                                        type="file"
                                        accept=".json"
                                        onChange={(e) => setBackupFile(e.target.files[0])}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-semibold">
                                        Type <code>RESTORE</code> to confirm
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder='Type "RESTORE"'
                                        value={restoreConfirm}
                                        onChange={(e) => setRestoreConfirm(e.target.value)}
                                    />
                                </Form.Group>
                                <Button
                                    variant="danger"
                                    onClick={handleRestore}
                                    disabled={restoring || restoreConfirm !== "RESTORE" || !backupFile}
                                >
                                    {restoring ? "Restoring..." : "Restore from Backup"}
                                </Button>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </Container>
    );
};

export default AdminBackup;
