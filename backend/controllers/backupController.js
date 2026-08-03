const User = require("../models/User");
const Semester = require("../models/Semester");
const Thesis = require("../models/Thesis");
const Schedule = require("../models/Schedule");
const ManualPlan = require("../models/ManualPlan");

const exportBackup = async (req, res) => {
    try {
        const users = await User.find().lean();
        const semesters = await Semester.find().lean();
        const theses = await Thesis.find().lean();
        const schedules = await Schedule.find().lean();

        const backup = {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            stats: {
                users: users.length,
                semesters: semesters.length,
                theses: theses.length,
                schedules: schedules.length,
            },
            data: {
                users,
                semesters,
                theses,
                schedules,
            },
        };

        res.status(200).json(backup);
    } catch (error) {
        console.error("Backup Export Error:", error.message);
        res.status(500).json({ message: "Export failed", error: error.message });
    }
};

const downloadBackup = async (req, res) => {
    try {
        const users = await User.find().lean();
        const semesters = await Semester.find().lean();
        const theses = await Thesis.find().lean();
        const schedules = await Schedule.find().lean();

        const backup = {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            stats: {
                users: users.length,
                semesters: semesters.length,
                theses: theses.length,
                schedules: schedules.length,
            },
            data: {
                users,
                semesters,
                theses,
                schedules,
            },
        };

        const filename = `thesismgr-backup-${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/json");
        res.status(200).send(JSON.stringify(backup, null, 2));
    } catch (error) {
        console.error("Backup Download Error:", error.message);
        res.status(500).json({ message: "Download failed", error: error.message });
    }
};

const restoreBackup = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No backup file uploaded" });
        }

        const backup = JSON.parse(req.file.buffer.toString());

        if (!backup.version || !backup.data) {
            return res.status(400).json({ message: "Invalid backup file format" });
        }

        const { users, semesters, theses, schedules } = backup.data;

        // Restore replaces the whole dataset, so clear existing collections first.
        // Upserting by _id is unsafe here: a backup document whose email already
        // exists on a different _id violates the unique email index (E11000).
        // Wiping + inserting with the original _ids preserves all references
        // (student/supervisor/semester) and the unique indexes.
        await Promise.all([
            User.deleteMany({}),
            Semester.deleteMany({}),
            Thesis.deleteMany({}),
            Schedule.deleteMany({}),
            ManualPlan.deleteMany({}),
        ]);

        let restored = { users: 0, semesters: 0, theses: 0, schedules: 0 };

        if (Array.isArray(users) && users.length > 0) {
            const inserted = await User.insertMany(users, { ordered: false });
            restored.users = inserted.length;
        }

        if (Array.isArray(semesters) && semesters.length > 0) {
            const inserted = await Semester.insertMany(semesters, { ordered: false });
            restored.semesters = inserted.length;
        }

        if (Array.isArray(theses) && theses.length > 0) {
            const inserted = await Thesis.insertMany(theses, { ordered: false });
            restored.theses = inserted.length;
        }

        if (Array.isArray(schedules) && schedules.length > 0) {
            const inserted = await Schedule.insertMany(schedules, { ordered: false });
            restored.schedules = inserted.length;
        }

        res.status(200).json({
            message: "Backup restored successfully",
            restored,
        });
    } catch (error) {
        console.error("Backup Restore Error:", error.message);
        res.status(500).json({ message: "Restore failed", error: error.message });
    }
};

module.exports = { exportBackup, downloadBackup, restoreBackup };
