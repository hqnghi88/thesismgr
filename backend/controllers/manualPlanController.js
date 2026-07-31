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
        const { semester, courseCode } = req.query;
        if (!semester || !courseCode) {
            return res.status(400).json({ message: "semester and courseCode query parameters are required" });
        }
        const plan = await populatePlan(ManualPlan.findOne({ semester, courseCode }));
        res.json(plan);
    } catch (error) {
        console.error("getManualPlan Error:", error);
        res.status(500).json({ message: "Server error in getManualPlan" });
    }
};

const autoPlanManual = async (req, res) => {
    try {
        const { semester, courseCode, startDate, capacity = 6, roomCount = 3, sessionsPerDay = 2 } = req.body;
        if (!semester || !courseCode) {
            return res.status(400).json({ message: "semester and courseCode are required" });
        }

        const theses = await Thesis.find({ semester, courseCode, status: { $ne: "completed" } })
            .populate('supervisor', 'name')
            .sort({ title: 1 });
        if (theses.length === 0) {
            return res.status(400).json({ message: `No theses for course code ${courseCode} in this semester.` });
        }

        const professors = await User.find({ role: { $in: ["professor", "admin"] } }).sort({ name: 1 });
        if (professors.length < 3) {
            return res.status(400).json({ message: "Not enough staff members (Professor or Admin) available." });
        }

        const sessions = sessionsPerDay >= 2 ? ["Sang", "Chieu"] : ["Sang"];
        const numRooms = Math.min(Math.max(parseInt(roomCount) || 1, 1), DEFAULT_ROOMS.length);
        const cap = Math.max(parseInt(capacity) || 6, 1);

        // Group theses by supervisor. Each supervisor heads the committee(s)
        // for their own theses (matching the reference Excel where e.g. "Tram 5"
        // is a committee led by supervisor Tram with 5 of Tram's theses).
        const bySupervisor = {};
        theses.forEach(t => {
            const supId = t.supervisor?._id?.toString() || t.supervisor?.toString();
            if (!supId) return;
            if (!bySupervisor[supId]) bySupervisor[supId] = { supId, supName: t.supervisor?.name || "", theses: [] };
            bySupervisor[supId].theses.push(t);
        });

        if (Object.keys(bySupervisor).length === 0) {
            return res.status(400).json({ message: "Theses have no supervisor assigned." });
        }

        // Split each supervisor's theses into as-evenly-as-possible committees.
        const allCommittees = [];
        Object.values(bySupervisor)
            .sort((a, b) => b.theses.length - a.theses.length || a.supName.localeCompare(b.supName))
            .forEach(group => {
                const n = group.theses.length;
                const chunks = Math.max(1, Math.ceil(n / cap));
                const base = Math.floor(n / chunks);
                const remainder = n % chunks;
                let idx = 0;
                for (let i = 0; i < chunks; i++) {
                    const size = base + (i < remainder ? 1 : 0);
                    allCommittees.push({
                        principal: group.supId,
                        examinator: null,
                        supervisor: null,
                        thesisIds: group.theses.slice(idx, idx + size).map(t => t._id),
                    });
                    idx += size;
                }
            });

        // Number of days is derived from how many committees we have.
        const perDay = sessions.length * numRooms;
        const numD = Math.max(1, Math.ceil(allCommittees.length / perDay));

        const anchorDay = new Date(startDate || new Date());
        anchorDay.setUTCHours(0, 0, 0, 0);

        const days = [];
        for (let d = 0; d < numD; d++) {
            const date = new Date(anchorDay);
            date.setDate(anchorDay.getDate() + d);
            days.push({
                date,
                sessions: sessions.map(sess => ({ session: sess, committees: [] })),
            });
        }

        // Assign the 2 other members of each committee, rotating through
        // professors so a supervisor never sits on their own committee.
        const sessionSlots = [];
        days.forEach((day, di) => day.sessions.forEach((sess, si) => {
            sessionSlots.push({ day: di, sess: si, count: 0, supIds: new Set() });
        }));

        let otherIdx = 0;
        // Place committees round-robin so a supervisor appears at most once per session.
        const maxChunks = Math.max(...Object.values(bySupervisor).map(g => Math.max(1, Math.ceil(g.theses.length / cap))));
        const sortedSupIds = Object.values(bySupervisor)
            .sort((a, b) => b.theses.length - a.theses.length || a.supName.localeCompare(b.supName))
            .map(g => g.supId);

        for (let r = 0; r < maxChunks; r++) {
            for (const supId of sortedSupIds) {
                const committee = allCommittees.find(c => c.principal === supId && c._used !== true);
                if (!committee) continue;
                committee._used = true;

                let slot = sessionSlots.find(s => s.count < numRooms && !s.supIds.has(supId))
                    || sessionSlots.find(s => s.count < numRooms);
                if (!slot) continue;

                slot.supIds.add(supId);
                slot.count++;

                const others = professors.filter(p => p._id.toString() !== supId);
                committee.examinator = others[otherIdx % others.length]._id;
                committee.supervisor = others[(otherIdx + 1) % others.length]._id;
                otherIdx++;

                committee.room = DEFAULT_ROOMS[slot.count - 1] || DEFAULT_ROOMS[0];
                days[slot.day].sessions[slot.sess].committees.push({
                    room: committee.room,
                    principal: committee.principal,
                    examinator: committee.examinator,
                    supervisor: committee.supervisor,
                    thesisIds: committee.thesisIds,
                });
            }
        }

        await ManualPlan.deleteOne({ semester, courseCode });
        const plan = new ManualPlan({ semester, courseCode, days });
        await plan.save();

        const saved = await populatePlan(ManualPlan.findOne({ semester, courseCode }));
        res.status(201).json({
            message: "Manual planning completed.",
            thesisCount: theses.length,
            numDays: numD,
            plan: saved,
        });
    } catch (error) {
        console.error("autoPlanManual Error:", error);
        res.status(500).json({ message: "Server error during manual planning" });
    }
};

const saveManualPlan = async (req, res) => {
    try {
        const { semester, courseCode, days } = req.body;
        if (!semester || !courseCode || !Array.isArray(days)) {
            return res.status(400).json({ message: "semester, courseCode and days array are required" });
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

        await ManualPlan.deleteOne({ semester, courseCode });
        const plan = new ManualPlan({ semester, courseCode, days: cleanDays });
        await plan.save();
        const saved = await populatePlan(ManualPlan.findOne({ semester, courseCode }));
        res.status(200).json({ message: "Manual plan saved.", plan: saved });
    } catch (error) {
        console.error("saveManualPlan Error:", error);
        res.status(500).json({ message: "Server error in saveManualPlan" });
    }
};

const deleteManualPlan = async (req, res) => {
    try {
        const { semester, courseCode } = req.query;
        if (!semester || !courseCode) {
            return res.status(400).json({ message: "semester and courseCode query parameters are required to prevent accidental data loss" });
        }
        await ManualPlan.deleteOne({ semester, courseCode });
        res.status(200).json({ message: "Manual plan deleted." });
    } catch (error) {
        console.error("deleteManualPlan Error:", error);
        res.status(500).json({ message: "Server error in deleteManualPlan" });
    }
};

const exportManualPlan = async (req, res) => {
    try {
        const { semester, courseCode } = req.query;
        if (!semester || !courseCode) {
            return res.status(400).json({ message: "semester and courseCode query parameters are required" });
        }
        const plan = await populatePlan(ManualPlan.findOne({ semester, courseCode }));
        if (!plan) {
            return res.status(404).json({ message: "No manual plan to export" });
        }

        const aoa = [[`MA HOC PHAN: ${plan.courseCode}`]];
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
        xlsx.utils.book_append_sheet(wb, ws, `Lich LVTN ${plan.courseCode}`);
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buf);
    } catch (error) {
        console.error("exportManualPlan Error:", error);
        res.status(500).json({ message: "Export error" });
    }
};

module.exports = { getManualPlan, autoPlanManual, saveManualPlan, deleteManualPlan, exportManualPlan };
