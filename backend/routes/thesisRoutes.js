const express = require("express");
const router = express.Router();
const { createThesis, getTheses, updateThesis, deleteThesis, getAllThesesAdmin, updateThesisAdmin, deleteAllTheses } = require("../controllers/thesisController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

router.post("/theses", authMiddleware, createThesis);
router.get("/theses", authMiddleware, getTheses);
router.put("/theses/:id", authMiddleware, updateThesis);
router.delete("/theses/:id", authMiddleware, deleteThesis);

// Admin Routes
router.get("/admin/theses", authMiddleware, adminMiddleware, getAllThesesAdmin);
router.put("/admin/theses/:id", authMiddleware, adminMiddleware, updateThesisAdmin);
router.delete("/admin/theses/all", authMiddleware, adminMiddleware, deleteAllTheses);

module.exports = router;

