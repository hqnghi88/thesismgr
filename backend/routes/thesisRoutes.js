const express = require("express");
const router = express.Router();
const { createThesis, getTheses, updateThesis, deleteThesis } = require("../controllers/thesisController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/theses", authMiddleware, createThesis);
router.get("/theses", authMiddleware, getTheses);
router.put("/theses/:id", authMiddleware, updateThesis);
router.delete("/theses/:id", authMiddleware, deleteThesis);

module.exports = router;
