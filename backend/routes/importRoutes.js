const express = require("express");
const router = express.Router();
const multer = require("multer");
const { importUsersFromExcel, importThesesFromExcel } = require("../controllers/importController");
const authMiddleware = require("../middleware/authMiddleware");

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Import users from Excel
router.post("/import-users", authMiddleware, upload.single('file'), importUsersFromExcel);

// Import theses from Excel (AdminTheses.jsx calls this)
router.post("/import-excel", authMiddleware, upload.single('file'), importThesesFromExcel);

module.exports = router;
