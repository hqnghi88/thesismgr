import React, { createContext, useContext, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [config, setConfig] = useState({
        show: false,
        title: "",
        message: "",
        type: "alert", // 'alert' or 'confirm'
        requirePhrase: null, // if set, user must type this phrase to enable Confirm
        onConfirm: null,
        onCancel: null
    });
    const [phrase, setPhrase] = useState("");

    const notify = (message, title = "Notification") => {
        return new Promise((resolve) => {
            setConfig({
                show: true,
                title,
                message,
                type: "alert",
                onConfirm: () => {
                    setConfig(prev => ({ ...prev, show: false }));
                    resolve(true);
                }
            });
        });
    };

    const confirm = (message, title = "Confirm Action", options = {}) => {
        setPhrase("");
        return new Promise((resolve) => {
            setConfig({
                show: true,
                title,
                message,
                type: "confirm",
                requirePhrase: options.requirePhrase || null,
                onConfirm: () => {
                    setConfig(prev => ({ ...prev, show: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setConfig(prev => ({ ...prev, show: false }));
                    resolve(false);
                }
            });
        });
    };

    const closeModal = () => {
        if (config.onCancel) {
            config.onCancel();
        } else {
            config.onConfirm();
        }
    };

    const phraseMatches = !config.requirePhrase || phrase === config.requirePhrase;

    return (
        <NotificationContext.Provider value={{ notify, confirm }}>
            {children}
            <Modal show={config.show} onHide={closeModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{config.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div>{config.message}</div>
                    {config.requirePhrase && (
                        <Form.Group className="mt-3">
                            <Form.Label className="fw-semibold">
                                Type <code>{config.requirePhrase}</code> to confirm
                            </Form.Label>
                            <Form.Control
                                type="text"
                                value={phrase}
                                onChange={(e) => setPhrase(e.target.value)}
                                placeholder={config.requirePhrase}
                            />
                        </Form.Group>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    {config.type === "confirm" && (
                        <Button variant="secondary" onClick={config.onCancel}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        variant={config.type === "confirm" ? "danger" : "primary"}
                        onClick={config.onConfirm}
                        disabled={!phraseMatches}
                    >
                        {config.type === "confirm" ? "Confirm" : "OK"}
                    </Button>
                </Modal.Footer>
            </Modal>
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);
