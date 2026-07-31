const express = require("express");
const router = express.Router();
const { getSemesters, getActiveSemester, createSemester, activateSemester, deleteSemester, migrateExistingData } = require("../controllers/semesterController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

router.get("/semesters", authMiddleware, getSemesters);
router.get("/semesters/active", authMiddleware, getActiveSemester);
router.post("/semesters", authMiddleware, adminMiddleware, createSemester);
router.put("/semesters/:id/activate", authMiddleware, adminMiddleware, activateSemester);
router.delete("/semesters/:id", authMiddleware, adminMiddleware, deleteSemester);
router.post("/semesters/migrate", authMiddleware, adminMiddleware, migrateExistingData);

module.exports = router;
