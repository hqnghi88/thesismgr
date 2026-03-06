// Create a middleware to protect routes

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token || token === "null" || token === "undefined") {
        return res.status(401).json({ message: "No token or invalid session, please login again." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("JWT Verification Error:", err.message);
        res.status(401).json({ message: "Invalid token" });
    }
};

module.exports = authMiddleware;