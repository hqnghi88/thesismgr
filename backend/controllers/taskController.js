const Task = require("../models/Task");

// Create Task
const createTask = async (req, res) => {
  try {
    const { title, description } = req.body;      // req.body contains the task details sent from the frontend via POST (title and description).
    const newTask = new Task({
      user: req.user.id,
      title,
      description,
    });
    await newTask.save();
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Create Task Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Task
const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id });
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Get Tasks Error:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
};

// Update Task
const updateTask = async (req, res) => {
  try {
    const updateTask = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },         // Updates a task based on task ID (req.params.id) and the user ID.
      req.body,                                         // req.body contains updated task data.
      { new: true }                                     // { new: true } makes sure MongoDB returns the updated version.
    );
    if (!updateTask) return res.status(404).json({ message: "Task not found" });
    res.status(200).json(updateTask);
  } catch (error) {
    console.error("Update Tasks Error:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
};

// Delete Task
const deleteTask = async (req, res) => {
  try {
    const deleted = await Task.findOneAndDelete({
      _id: req.params.id,                                  // Deletes a task matching both ID and user.
      user: req.user.id,
    });
    if (!deleted) return res.status(404).json({ message: "Task not found" });
    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete Tasks Error:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = { createTask, getTasks, updateTask, deleteTask };
