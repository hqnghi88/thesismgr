import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Dashboard.css";

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [roleFilter, setRoleFilter] = useState("all");
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
    const [editId, setEditId] = useState(null);

    const token = localStorage.getItem("token");

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUsers(res.data);
        } catch (err) {
            console.error("Fetch users error:", err.response?.data || err.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/users/${editId}`, form, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/users`, form, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
            setForm({ name: "", email: "", password: "", role: "student" });
            setEditId(null);
            setShowForm(false);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.message || "Error saving user");
        }
    };

    const handleEdit = (user) => {
        setEditId(user._id);
        setForm({ name: user.name, email: user.email, password: "", role: user.role });
        setShowForm(true);
    };

    const handleDelete = async (userId) => {
        if (!window.confirm("Are you sure you want to delete this user?")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchUsers();
        } catch (err) {
            alert("Error deleting user");
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter((user) =>
        roleFilter === "all" ? true : user.role === roleFilter
    );

    return (
        <div className="dashboard-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="dashboard-heading" style={{ margin: 0 }}>User & Staff Management</h2>
                <button
                    onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: "", email: "", password: "", role: "student" }); }}
                    style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
                >
                    {showForm ? "Cancel" : "Add New User"}
                </button>
            </div>

            {showForm && (
                <form className="task-form" onSubmit={handleSubmit} style={{ marginBottom: '30px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ marginTop: 0 }}>{editId ? "Edit User" : "Create New User"}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <input
                            type="text"
                            className="task-input"
                            placeholder="Full Name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                        <input
                            type="email"
                            className="task-input"
                            placeholder="Email Address"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                        />
                        {!editId && (
                            <input
                                type="password"
                                className="task-input"
                                placeholder="Password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                            />
                        )}
                        <select
                            className="task-input"
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value })}
                            required
                            style={{ padding: '10px', borderRadius: '6px' }}
                        >
                            <option value="student">Student</option>
                            <option value="professor">Professor</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button type="submit" style={{ marginTop: '15px', width: '100%' }}>
                        {editId ? "Update User" : "Save User"}
                    </button>
                </form>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <label>Filter View:</label>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                >
                    <option value="all">All Users</option>
                    <option value="professor">Professors</option>
                    <option value="student">Students</option>
                    <option value="admin">Admins</option>
                </select>
            </div>

            <div className="tasks-container" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <thead>
                        <tr style={{ background: '#4f46e5', color: 'white' }}>
                            <th style={{ padding: '15px', textAlign: 'left' }}>Name</th>
                            <th style={{ padding: '15px', textAlign: 'left' }}>Email</th>
                            <th style={{ padding: '15px', textAlign: 'left' }}>Role</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user) => (
                            <tr key={user._id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '15px' }}>{user.name}</td>
                                <td style={{ padding: '15px' }}>{user.email}</td>
                                <td style={{ padding: '15px' }}>
                                    <span className={`task-status ${user.role}`} style={{ textTransform: 'capitalize' }}>
                                        {user.role}
                                    </span>
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                    <button
                                        onClick={() => handleEdit(user)}
                                        style={{ background: '#facc15', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user._id)}
                                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No users found for this filter.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminUsers;
