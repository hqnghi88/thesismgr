const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importExcel } = require('../controllers/importController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/import-excel', authMiddleware, adminMiddleware, upload.single('file'), importExcel);

module.exports = router;
