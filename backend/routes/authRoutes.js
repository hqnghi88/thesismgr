const express = require("express");
const router = express.Router();
const { registerUser, loginUser, getProfessors, getAllUsers, updateUserRole, deleteUser, createUser, updateUserAdmin } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// POST /api/register
router.post('/register', registerUser);

// POST /api/login
router.post('/login', loginUser);

router.get('/professors', authMiddleware, getProfessors);

// Admin Routes
router.get('/users', authMiddleware, adminMiddleware, getAllUsers);
router.post('/users', authMiddleware, adminMiddleware, createUser);
router.put('/users/:id', authMiddleware, adminMiddleware, updateUserAdmin);
router.put('/users/:id/role', authMiddleware, adminMiddleware, updateUserRole);
router.delete('/users/:id', authMiddleware, adminMiddleware, deleteUser);


router.get('/dashboard', authMiddleware, (req, res) => {


    res.json({ message: `Welcome, user ${req.user.id}` });
});

//router.post('/add-task', authMiddleware, addTask);         
// First, authMiddleware will run and check the token.
// If the token is valid, the user is allowed to continue.
// If not, it stops right there.



module.exports = router;