const express = require("express");
const router = express.Router();
const multer = require("multer");
const { exportBackup, downloadBackup, restoreBackup } = require("../controllers/backupController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/backup", authMiddleware, adminMiddleware, exportBackup);
router.get("/backup/download", authMiddleware, adminMiddleware, downloadBackup);
router.post("/backup/restore", authMiddleware, adminMiddleware, upload.single("backup"), restoreBackup);

module.exports = router;
