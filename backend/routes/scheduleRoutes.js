const express = require("express");
const router = express.Router();
const { autoPlan, getSchedules, deleteSchedule } = require("../controllers/scheduleController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/schedule/auto-plan", authMiddleware, autoPlan);
router.get("/schedules", authMiddleware, getSchedules);
router.delete("/schedule/:id", authMiddleware, deleteSchedule);


module.exports = router;
