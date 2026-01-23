import React from "react";
import { useEffect, useState } from "react";
import axios from "axios";
import "./Dashboard.css";

const Dashboard = () => {
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString(); // e.g. "6/27/2025, 3:30:45 PM"
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ title: "", description: "" });

  const token = localStorage.getItem("token");

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(res.data);
    } catch (err) {
      console.error("Fetch error:", err.response?.data || data.message);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  console.log("Rendering tasks:", tasks);

  // Delete handler function
  const handleDelete = async (taskId) => {
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Remove the task from frontend state
      setTasks(tasks.filter((task) => task._id !== taskId));
    } catch (err) {
      console.error("Delete task error:", err.response?.data || data.message);
    }
  };

  // Edit Task
  const [editId, setEditId] = useState(null);

  // Completion Checkbox
  const handleToggleComplete = async (taskId, currentStatus) => {
    try {
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/tasks/${taskId}`,
        { completed: !currentStatus }, // toggle
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update the task in the UI
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task._id === res.data._id ? res.data : task))
      );
    } catch (err) {
      console.error(
        "Toggle complete error:",
        err.response?.data || err.message
      );
    }
  };

  // filter state
  const [filter, setFilter] = useState("all"); // all, completed, incomplete
  const filteredTasks = tasks
    .filter((task) => {
      const matchesFilter =
        filter === "completed"
          ? task.completed === true
          : filter === "incomplete"
          ? task.completed === false
          : true;

      const matchesSearch = task.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-heading">My Tasks</h2>
      <form
        className="task-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            if (editId) {
              // Editing an existing task
              const res = await axios.put(
                `${import.meta.env.VITE_API_URL}/api/tasks/${editId}`,
                form,
                { headers: { Authorization: `Bearer ${token}` } }
              );

              console.log("Task Updated:", res.data);
              setTasks(
                tasks.map((task) => (task._id === editId ? res.data : task))
              );

              setEditId(null); // Reset after editing
              await fetchTasks();
            } else {
              // Creating a new task
              console.log("Submitting:", form);
              const res = await axios.post(
                `${import.meta.env.VITE_API_URL}/api/tasks`,
                form, // this includes title and description
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              console.log("Task Created:", res.data);
              // Add new task to the existing tasks list
              setTasks([...tasks, res.data]);
            }

            // Reset the form
            setForm({ title: "", description: "" });
          } catch (err) {
            console.error("Add task error:", err.response?.data || err.message);
          }
        }}
      >
        <div className="task-form-container">
          <input
            type="text"
            className="task-input"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <textarea
            type="text"
            className="task-textarea"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <button style={{backgroundColor: "#41b341"}} type="submit" disabled={!form.title || !form.description}>
            {editId ? "Update Task" : "Add Task"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setForm({ title: "", description: "" });
              }}
              style={{ margin: "10px", backgroundColor: "#ef4444"}}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Filter buttons */}
      <div className="filter-buttons">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          className={filter === "completed" ? "active" : ""}
          onClick={() => setFilter("completed")}
        >
          Completed
        </button>
        <button
          className={filter === "incomplete" ? "active" : ""}
          onClick={() => setFilter("incomplete")}
        >
          Incomplete
        </button>
      </div>

      <input
        type="text"
        className="search-bar"
        placeholder="Search by title..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: "15px", padding: "15px", width: "260px" }}
      />

      <div className="tasks-container">
        {filteredTasks.length === 0 ? (
          <p>No Tasks Found</p>
        ) : (
          filteredTasks.map((task) => {
            return (
              <div key={task._id} className="task-card">
                <input
                  type="checkbox"
                  className="task-checkbox"
                  checked={task.completed}
                  onChange={() =>
                    handleToggleComplete(task._id, task.completed)
                  }
                />

                <div
                  className={`task-title ${task.completed ? "completed" : ""}`}
                >
                  {task.completed ? "✅" : "📝"} {task.title}
                </div>
                <div
                  className={`task-status ${task.completed ? "completed" : ""}`}
                >
                  {task.completed ? "Completed" : "In Progress"}
                </div>
                <p className="task-desc">{task.description}</p>

                <p className="task-meta">
                  Created At: {formatDate(task.createdAt)}
                </p>

                <div className="task-buttons">
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(task._id)}
                  >
                    Delete
                  </button>
                  <button
                    className="edit-btn"
                    onClick={() => {
                      setEditId(task._id);
                      setForm({
                        title: task.title,
                        description: task.description,
                      });
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Dashboard;
