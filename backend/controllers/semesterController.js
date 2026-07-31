const Semester = require("../models/Semester");
const Thesis = require("../models/Thesis");

const migrateExistingData = async (req, res) => {
    try {
        let hk2 = await Semester.findOne({ name: "HK2-2025-2026" });
        if (!hk2) {
            hk2 = new Semester({
                name: "HK2-2025-2026",
                displayName: "Học kỳ 2 - Năm học 2025-2026",
                isActive: true,
            });
            await hk2.save();
        }

        const result = await Thesis.updateMany(
            { semester: { $exists: false } },
            { $set: { semester: hk2._id } }
        );

        const total = await Thesis.countDocuments();
        const migrated = await Thesis.countDocuments({ semester: hk2._id });

        res.status(200).json({
            message: "Migration complete",
            semesterCreated: hk2.name,
            thesesMigrated: result.modifiedCount,
            totalTheses: total,
            thesesInHK2: migrated
        });
    } catch (error) {
        console.error("Migration Error:", error);
        res.status(500).json({ message: "Migration failed", error: error.message });
    }
};

const getSemesters = async (req, res) => {
    try {
        const semesters = await Semester.find().sort({ createdAt: -1 });
        res.status(200).json(semesters);
    } catch (error) {
        console.error("Get Semesters Error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

const getActiveSemester = async (req, res) => {
    try {
        const active = await Semester.findOne({ isActive: true });
        res.status(200).json(active);
    } catch (error) {
        console.error("Get Active Semester Error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

const createSemester = async (req, res) => {
    try {
        const { name, displayName } = req.body;
        if (!name || !displayName) {
            return res.status(400).json({ message: "Name and displayName are required" });
        }
        const existing = await Semester.findOne({ name });
        if (existing) {
            return res.status(400).json({ message: "Semester with this name already exists" });
        }
        const semester = new Semester({ name, displayName });
        await semester.save();
        res.status(201).json(semester);
    } catch (error) {
        console.error("Create Semester Error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

const activateSemester = async (req, res) => {
    try {
        const { id } = req.params;
        const semester = await Semester.findById(id);
        if (!semester) {
            return res.status(404).json({ message: "Semester not found" });
        }
        await Semester.updateMany({}, { isActive: false });
        semester.isActive = true;
        await semester.save();
        res.status(200).json({ message: `Activated semester: ${semester.displayName}`, semester });
    } catch (error) {
        console.error("Activate Semester Error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

const deleteSemester = async (req, res) => {
    try {
        const semester = await Semester.findById(req.params.id);
        if (!semester) {
            return res.status(404).json({ message: "Semester not found" });
        }
        if (semester.isActive) {
            return res.status(400).json({ message: "Cannot delete the active semester. Activate another semester first." });
        }
        await Semester.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Semester deleted" });
    } catch (error) {
        console.error("Delete Semester Error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { getSemesters, getActiveSemester, createSemester, activateSemester, deleteSemester, migrateExistingData };
