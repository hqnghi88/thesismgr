const express = require("express");
const router = express.Router();
const { autoPlan, getSchedules, updateSchedule, deleteSchedule, exportSchedules } = require("../controllers/scheduleController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/schedule/auto-plan", authMiddleware, autoPlan);
router.get("/schedules", authMiddleware, getSchedules);
router.put("/schedule/:id", authMiddleware, updateSchedule);
router.delete("/schedule/:id", authMiddleware, deleteSchedule);
router.get("/schedule/export", authMiddleware, exportSchedules);


module.exports = router;
