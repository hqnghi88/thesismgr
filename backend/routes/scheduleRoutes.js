const express = require("express");
const router = express.Router();
const { autoPlan, getSchedules, updateSchedule, deleteSchedule, exportSchedules, deleteAllSchedules } = require("../controllers/scheduleController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

router.post("/schedule/auto-plan", authMiddleware, autoPlan);
router.get("/schedules", authMiddleware, getSchedules);
router.get("/schedule/export", authMiddleware, exportSchedules);
router.delete("/schedule/all", authMiddleware, adminMiddleware, deleteAllSchedules);
router.put("/schedule/:id", authMiddleware, updateSchedule);
router.delete("/schedule/:id", authMiddleware, deleteSchedule);

module.exports = router;
