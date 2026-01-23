const express = require("express");
const router = express.Router();
const multer = require("multer");
const { importUsersFromExcel } = require("../controllers/importController");
const authMiddleware = require("../middleware/authMiddleware");

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Import users from Excel
router.post("/import-users", authMiddleware, upload.single('file'), importUsersFromExcel);

module.exports = router;
