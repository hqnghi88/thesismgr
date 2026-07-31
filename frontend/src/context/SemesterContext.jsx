import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const SemesterContext = createContext();

export const useSemester = () => useContext(SemesterContext);

export const SemesterProvider = ({ children }) => {
    const [semesters, setSemesters] = useState([]);
    const [activeSemester, setActiveSemester] = useState(null);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem("token");

    const fetchSemesters = async () => {
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/semesters`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSemesters(res.data);

            const active = res.data.find(s => s.isActive);
            setActiveSemester(active || null);

            // Persist to localStorage
            if (active) {
                localStorage.setItem("activeSemesterId", active._id);
            }
        } catch (err) {
            console.error("Fetch semesters error:", err);
        } finally {
            setLoading(false);
        }
    };

    const switchSemester = async (semesterId) => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/semesters/${semesterId}/activate`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchSemesters();
        } catch (err) {
            console.error("Switch semester error:", err);
            throw err;
        }
    };

    const createSemester = async (name, displayName) => {
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/semesters`, { name, displayName }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchSemesters();
            return res.data;
        } catch (err) {
            console.error("Create semester error:", err);
            throw err;
        }
    };

    const deleteSemester = async (id) => {
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/semesters/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchSemesters();
        } catch (err) {
            console.error("Delete semester error:", err);
            throw err;
        }
    };

    useEffect(() => {
        fetchSemesters();
    }, [token]);

    return (
        <SemesterContext.Provider value={{
            semesters,
            activeSemester,
            loading,
            switchSemester,
            createSemester,
            deleteSemester,
            refreshSemesters: fetchSemesters,
        }}>
            {children}
        </SemesterContext.Provider>
    );
};
