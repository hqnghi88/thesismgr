const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
} = require("../controllers/taskController");

// Create Task
router.post("/tasks", authMiddleware, createTask);

// Get all tasks for a user
router.get("/tasks", authMiddleware, getTasks);

// Update task by ID
router.put("/tasks/:id", authMiddleware, updateTask);

// Delete task by ID
router.delete("/tasks/:id", authMiddleware, deleteTask);

module.exports = router;
