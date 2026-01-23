const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    console.log("Entered PW:", password);
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Stored Hashed PW:", hashedPassword);

    // Create and save new user
    const newUser = new User({ name, email, password: hashedPassword, role: role || 'student' });
    await newUser.save();


    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Register Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // 2. Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    console.log("Entered password:", password);
    console.log("Stored hashed password:", user.password);
    console.log("Password Match:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid Credentails" });
    }

    // Create JWT Token
    const token = jwt.sign(
      { id: user._id, role: user.role }, // Payload
      process.env.JWT_SECRET,           // Secret key 
      { expiresIn: "1d" }                // expiry
    );


    // 3. If everything is okay
    res.status(200).json({
      message: "Login successful",
      token,                              // this allows the frontend to save the token (in local storage or cookies) 
      user: {                             // use the token to acces protected routes like /api/tasks, /api/dashboard
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }

    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['student', 'professor', 'admin'].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, role: role || 'student' });
    await newUser.save();
    res.status(201).json({ message: "User created successfully", user: { id: newUser._id, name, email, role: newUser.role } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const updateUserAdmin = async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { name, email, role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getProfessors = async (req, res) => {
  try {
    const professors = await User.find({ role: 'professor' }).select('name email');
    res.status(200).json(professors);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const deleteUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    if (!['student', 'professor'].includes(role)) {
      return res.status(400).json({ message: "Invalid role for bulk delete" });
    }
    const result = await User.deleteMany({ role });
    res.status(200).json({ message: `Successfully deleted ${result.deletedCount} ${role}s` });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { registerUser, loginUser, getProfessors, getAllUsers, updateUserRole, deleteUser, createUser, updateUserAdmin, deleteUsersByRole };




