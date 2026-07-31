const express = require("express");
const router = express.Router();
const { getManualPlan, autoPlanManual, saveManualPlan, deleteManualPlan, exportManualPlan } = require("../controllers/manualPlanController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

router.get("/manual-plan", authMiddleware, getManualPlan);
router.get("/manual-plan/export", authMiddleware, adminMiddleware, exportManualPlan);
router.post("/manual-plan/auto-plan", authMiddleware, adminMiddleware, autoPlanManual);
router.put("/manual-plan", authMiddleware, adminMiddleware, saveManualPlan);
router.delete("/manual-plan", authMiddleware, adminMiddleware, deleteManualPlan);

module.exports = router;
