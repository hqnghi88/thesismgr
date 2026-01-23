const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    console.log("Entered PW:", password);
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Stored Hashed PW:", hashedPassword);

    // Create and save new user
    const newUser = new User({ name, email, password: hashedPassword });
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
        { id: user._id },                 // Payload (data we include in the token)
        process.env.JWT_SECRET,           // Secret key used to sign the token
        {expiresIn: "1d"}                // token will expire in 1 day
    );

    // 3. If everything is okay
    res.status(200).json({ 
        message: "Login successful",
        token,                              // this allows the frontend to save the token (in local storage or cookies) 
        user: {                             // use the token to acces protected routes like /api/tasks, /api/dashboard
            id: user._id,
            name: user.name,
            email: user.email
        }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { registerUser, loginUser };
