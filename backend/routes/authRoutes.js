const express = require("express");
const router = express.Router();
const { registerUser, loginUser, getProfessors } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// POST /api/register
router.post('/register', registerUser);

// POST /api/login
router.post('/login', loginUser);

router.get('/professors', authMiddleware, getProfessors);

router.get('/dashboard', authMiddleware, (req, res) => {

    res.json({ message: `Welcome, user ${req.user.id}` });
});

//router.post('/add-task', authMiddleware, addTask);         
// First, authMiddleware will run and check the token.
// If the token is valid, the user is allowed to continue.
// If not, it stops right there.



module.exports = router;