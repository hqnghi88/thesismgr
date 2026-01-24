import React, { createContext, useContext, useState } from "react";
import { Modal, Button } from "react-bootstrap";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [config, setConfig] = useState({
        show: false,
        title: "",
        message: "",
        type: "alert", // 'alert' or 'confirm'
        onConfirm: null,
        onCancel: null
    });

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

    const confirm = (message, title = "Confirm Action") => {
        return new Promise((resolve) => {
            setConfig({
                show: true,
                title,
                message,
                type: "confirm",
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

    return (
        <NotificationContext.Provider value={{ notify, confirm }}>
            {children}
            <Modal show={config.show} onHide={() => config.onCancel ? config.onCancel() : config.onConfirm()} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{config.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>{config.message}</Modal.Body>
                <Modal.Footer>
                    {config.type === "confirm" && (
                        <Button variant="secondary" onClick={config.onCancel}>
                            Cancel
                        </Button>
                    )}
                    <Button variant={config.type === "confirm" ? "danger" : "primary"} onClick={config.onConfirm}>
                        {config.type === "confirm" ? "Confirm" : "OK"}
                    </Button>
                </Modal.Footer>
            </Modal>
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);
