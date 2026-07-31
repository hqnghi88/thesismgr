const ManualPlan = require("../models/ManualPlan");
const Thesis = require("../models/Thesis");
const User = require("../models/User");
const xlsx = require("xlsx");

const DEFAULT_ROOMS = ["Room 110/DI", "Room 111/DI", "Room 112/DI", "Room 113/DI"];

const populatePlan = (query) =>
    query
        .populate('days.sessions.committees.principal', 'name')
        .populate('days.sessions.committees.examinator', 'name')
        .populate('days.sessions.committees.supervisor', 'name');

const getManualPlan = async (req, res) => {
    try {
        const { semester } = req.query;
        if (!semester) {
            return res.status(400).json({ message: "semester query parameter is required" });
        }
        const plan = await populatePlan(ManualPlan.findOne({ semester }));
        res.json(plan);
    } catch (error) {
        console.error("getManualPlan Error:", error);
        res.status(500).json({ message: "Server error in getManualPlan" });
    }
};

const autoPlanManual = async (req, res) => {
    try {
        const { semester, startDate, numDays = 3, roomCount = 3, sessionsPerDay = 2 } = req.body;
        if (!semester) {
            return res.status(400).json({ message: "semester is required" });
        }

        const theses = await Thesis.find({ semester, status: "approved" }).sort({ title: 1 });
        if (theses.length === 0) {
            return res.status(400).json({ message: "No approved theses for this semester." });
        }

        const professors = await User.find({ role: { $in: ["professor", "admin"] } }).sort({ name: 1 });
        if (professors.length < 3) {
            return res.status(400).json({ message: "Not enough staff members (Professor or Admin) available." });
        }

        const sessions = sessionsPerDay >= 2 ? ["Sang", "Chieu"] : ["Sang"];
        const numRooms = Math.min(Math.max(parseInt(roomCount) || 1, 1), DEFAULT_ROOMS.length);
        const numD = Math.max(parseInt(numDays) || 1, 1);

        const anchorDay = new Date(startDate || new Date());
        anchorDay.setUTCHours(0, 0, 0, 0);

        const days = [];
        for (let d = 0; d < numD; d++) {
            const date = new Date(anchorDay);
            date.setDate(anchorDay.getDate() + d);
            const daySessions = sessions.map(sess => ({
                session: sess,
                committees: Array.from({ length: numRooms }, (_, r) => ({
                    room: DEFAULT_ROOMS[r],
                    principal: null,
                    examinator: null,
                    supervisor: null,
                    thesisIds: [],
                })),
            }));
            days.push({ date, sessions: daySessions });
        }

        let profIdx = 0;
        const n = professors.length;
        days.forEach(day => {
            day.sessions.forEach(sess => {
                sess.committees.forEach(c => {
                    c.principal = professors[profIdx % n]._id;
                    c.examinator = professors[(profIdx + 1) % n]._id;
                    c.supervisor = professors[(profIdx + 2) % n]._id;
                    profIdx += 3;
                });
            });
        });

        const allCommittees = [];
        days.forEach(day => day.sessions.forEach(sess => allCommittees.push(...sess.committees)));
        theses.forEach((t, i) => {
            allCommittees[i % allCommittees.length].thesisIds.push(t._id);
        });

        await ManualPlan.deleteOne({ semester });
        const plan = new ManualPlan({ semester, days });
        await plan.save();

        const saved = await populatePlan(ManualPlan.findOne({ semester }));
        res.status(201).json({
            message: "Manual planning completed.",
            thesisCount: theses.length,
            plan: saved,
        });
    } catch (error) {
        console.error("autoPlanManual Error:", error);
        res.status(500).json({ message: "Server error during manual planning" });
    }
};

const saveManualPlan = async (req, res) => {
    try {
        const { semester, days } = req.body;
        if (!semester || !Array.isArray(days)) {
            return res.status(400).json({ message: "semester and days array are required" });
        }

        const cleanId = (v) => (v && v._id ? v._id : v) || null;
        const cleanDays = days.map(day => ({
            date: day.date,
            sessions: (day.sessions || []).map(sess => ({
                session: sess.session,
                committees: (sess.committees || []).map(c => ({
                    room: c.room || "",
                    principal: cleanId(c.principal),
                    examinator: cleanId(c.examinator),
                    supervisor: cleanId(c.supervisor),
                    thesisIds: (c.thesisIds || []).map(t => cleanId(t)),
                })),
            })),
        }));

        await ManualPlan.deleteOne({ semester });
        const plan = new ManualPlan({ semester, days: cleanDays });
        await plan.save();
        const saved = await populatePlan(ManualPlan.findOne({ semester }));
        res.status(200).json({ message: "Manual plan saved.", plan: saved });
    } catch (error) {
        console.error("saveManualPlan Error:", error);
        res.status(500).json({ message: "Server error in saveManualPlan" });
    }
};

const deleteManualPlan = async (req, res) => {
    try {
        const { semester } = req.query;
        if (!semester) {
            return res.status(400).json({ message: "semester query parameter is required to prevent accidental data loss" });
        }
        await ManualPlan.deleteOne({ semester });
        res.status(200).json({ message: "Manual plan deleted." });
    } catch (error) {
        console.error("deleteManualPlan Error:", error);
        res.status(500).json({ message: "Server error in deleteManualPlan" });
    }
};

const exportManualPlan = async (req, res) => {
    try {
        const { semester } = req.query;
        if (!semester) {
            return res.status(400).json({ message: "semester query parameter is required" });
        }
        const plan = await populatePlan(ManualPlan.findOne({ semester }));
        if (!plan) {
            return res.status(404).json({ message: "No manual plan to export" });
        }

        const aoa = [];
        plan.days.forEach(day => {
            const dd = new Date(day.date);
            const dateLabel = `${dd.getUTCDate()}/${dd.getUTCMonth() + 1}`;
            day.sessions.forEach(sess => {
                aoa.push([`Ngay ${dateLabel}`]);
                const row1 = [sess.session];
                const row2 = [""];
                const row3 = [""];
                sess.committees.forEach(c => {
                    const count = c.thesisIds.length;
                    row1.push(c.principal?.name || "", count, "");
                    row2.push(c.examinator?.name || "", "", "");
                    row3.push(c.supervisor?.name || "", "", "");
                });
                aoa.push(row1);
                aoa.push(row2);
                aoa.push(row3);
            });
        });

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(aoa);
        ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 6 }, { wch: 24 }, { wch: 6 }, { wch: 24 }, { wch: 6 }];
        xlsx.utils.book_append_sheet(wb, ws, "Lich LVTN");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buf);
    } catch (error) {
        console.error("exportManualPlan Error:", error);
        res.status(500).json({ message: "Export error" });
    }
};

module.exports = { getManualPlan, autoPlanManual, saveManualPlan, deleteManualPlan, exportManualPlan };
