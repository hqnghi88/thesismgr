const express = require("express");
const router = express.Router();
const { autoPlan, getSchedules } = require("../controllers/scheduleController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/schedule/auto-plan", authMiddleware, autoPlan);
router.get("/schedules", authMiddleware, getSchedules);

module.exports = router;
