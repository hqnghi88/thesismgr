const express = require("express");
const router = express.Router();
const { autoPlan, getSchedules, updateSchedule, deleteSchedule, exportSchedules, exportDocx, deleteAllSchedules, swapSchedules } = require("../controllers/scheduleController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

router.post("/schedule/auto-plan", authMiddleware, adminMiddleware, autoPlan);
router.get("/schedules", authMiddleware, getSchedules);
router.get("/schedule/export", authMiddleware, adminMiddleware, exportSchedules);
router.get("/schedule/export-docx", authMiddleware, adminMiddleware, exportDocx);
router.delete("/schedule/all", authMiddleware, adminMiddleware, deleteAllSchedules);
router.delete("/schedule/:id", authMiddleware, adminMiddleware, deleteSchedule);
router.post("/schedule/swap", authMiddleware, adminMiddleware, swapSchedules);
router.put("/schedule/:id", authMiddleware, adminMiddleware, updateSchedule);

module.exports = router;
