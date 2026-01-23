// Create a middleware to protect routes

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    // Get token from the header like: Bearer <token>               // Authorization: Bearer eyJhbGciOiJIUzI1...
    const token = req.headers.authorization?.split(" ")[1];        // looks for the token in the Authorization header of the request
    // token = eyJhbGciOiJIUzI1...

    if(!token){
        return res.status(401).json({message: "No token, authorization denied"});
    }

    try{
        // Decode and verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Store user in the request so next route can use it 
        req.user = decoded;

        // Continue to the next middleware/route
        next();        // go to the controller 
    }catch(err){
        res.status(401).json({message: "Invalid token"});
    }
};

module.exports = authMiddleware;