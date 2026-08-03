const ManualPlan = require("../models/ManualPlan");
const Thesis = require("../models/Thesis");
const User = require("../models/User");
const xlsx = require("xlsx");

const DEFAULT_ROOMS = ["Room 110/DI", "Room 111/DI", "Room 112/DI", "Room 113/DI"];

const populatePlan = (query) =>
    query
        .populate('days.sessions.committees.principal', 'name')
        .populate('days.sessions.committees.examinator', 'name')
        .populate('days.sessions.committees.supervisor', 'name')
        .populate('unassignedThesisIds', 'title');

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
        const { semester, startDate, capacity = 6, roomCount = 3, sessionsPerDay = 2 } = req.body;
        if (!semester) {
            return res.status(400).json({ message: "semester is required" });
        }

        const theses = await Thesis.find({ semester, status: { $ne: "completed" } })
            .populate('supervisor', 'name')
            .sort({ title: 1 });
        if (theses.length === 0) {
            return res.status(400).json({ message: "No theses for this semester." });
        }

        const professors = await User.find({ role: { $in: ["professor", "admin"] } }).sort({ name: 1 });
        if (professors.length < 3) {
            return res.status(400).json({ message: "Not enough staff members (Professor or Admin) available." });
        }

        const sessions = sessionsPerDay >= 2 ? ["Sang", "Chieu"] : ["Sang"];
        const numRooms = Math.min(Math.max(parseInt(roomCount) || 1, 1), DEFAULT_ROOMS.length);
        const cap = Math.max(parseInt(capacity) || 6, 1);

        // Group theses by (course code, supervisor). Each supervisor heads the
        // committee(s) for their own theses within each course (matching the
        // reference Excel where e.g. "Tram 5" is a committee led by supervisor
        // Tram with 5 of Tram's theses).
        const groups = {};
        theses.forEach(t => {
            const course = (t.courseCode || "").trim();
            const supId = t.supervisor?._id?.toString() || t.supervisor?.toString();
            if (!supId) return;
            const key = `${course}||${supId}`;
            if (!groups[key]) groups[key] = { courseCode: course, supId, supName: t.supervisor?.name || "", theses: [] };
            groups[key].theses.push(t);
        });

        if (Object.keys(groups).length === 0) {
            return res.status(400).json({ message: "Theses have no supervisor assigned." });
        }

        // Split each group's theses into as-evenly-as-possible committees.
        const allCommittees = [];
        const groupOrder = Object.values(groups)
            .sort((a, b) => b.theses.length - a.theses.length || a.supName.localeCompare(b.supName) || a.courseCode.localeCompare(b.courseCode));
        groupOrder.forEach(group => {
            const n = group.theses.length;
            const chunks = Math.max(1, Math.ceil(n / cap));
            const base = Math.floor(n / chunks);
            const remainder = n % chunks;
            let idx = 0;
            for (let i = 0; i < chunks; i++) {
                const size = base + (i < remainder ? 1 : 0);
                allCommittees.push({
                    courseCode: group.courseCode,
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

        // One slot per (day, session). A professor can belong to at most one
        // committee per slot regardless of course code, and each slot holds up
        // to numRooms committees (one per room).
        const sessionSlots = [];
        days.forEach((day, di) => day.sessions.forEach((sess, si) => {
            sessionSlots.push({ day: di, sess: si, count: 0, profIds: new Set() });
        }));

        let otherIdx = 0;
        allCommittees.forEach(committee => {
            for (const slot of sessionSlots) {
                if (slot.count >= numRooms) continue;
                if (slot.profIds.has(committee.principal)) continue;

                const others = professors.filter(p =>
                    p._id.toString() !== committee.principal && !slot.profIds.has(p._id.toString()));
                if (others.length < 2) continue;

                const m2 = others[otherIdx % others.length];
                const m3 = others[(otherIdx + 1) % others.length];

                slot.profIds.add(committee.principal);
                slot.profIds.add(m2._id.toString());
                slot.profIds.add(m3._id.toString());
                slot.count++;
                otherIdx++;

                days[slot.day].sessions[slot.sess].committees.push({
                    courseCode: committee.courseCode,
                    room: DEFAULT_ROOMS[slot.count - 1] || DEFAULT_ROOMS[0],
                    principal: committee.principal,
                    examinator: m2._id,
                    supervisor: m3._id,
                    thesisIds: committee.thesisIds,
                });
                break;
            }
        });

        await ManualPlan.deleteOne({ semester });
        const plan = new ManualPlan({ semester, days });
        await plan.save();

        const saved = await populatePlan(ManualPlan.findOne({ semester }));
        res.status(201).json({
            message: "Manual planning completed for all course codes.",
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
        const { semester, days, unassignedThesisIds } = req.body;
        if (!semester || !Array.isArray(days)) {
            return res.status(400).json({ message: "semester and days array are required" });
        }

        const cleanId = (v) => (v && v._id ? v._id : v) || null;
        const cleanDays = days.map(day => ({
            date: day.date,
            sessions: (day.sessions || []).map(sess => ({
                session: sess.session,
                committees: (sess.committees || []).map(c => ({
                    courseCode: c.courseCode || "",
                    room: c.room || "",
                    principal: cleanId(c.principal),
                    examinator: cleanId(c.examinator),
                    supervisor: cleanId(c.supervisor),
                    thesisIds: (c.thesisIds || []).map(t => cleanId(t)),
                })),
            })),
        }));

        await ManualPlan.deleteOne({ semester });
        const plan = new ManualPlan({
            semester,
            days: cleanDays,
            unassignedThesisIds: Array.isArray(unassignedThesisIds)
                ? unassignedThesisIds.map(t => cleanId(t))
                : [],
        });
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

        // Group committees by course code, one sheet per course.
        const courses = {};
        plan.days.forEach(day => day.sessions.forEach(sess => sess.committees.forEach(c => {
            const code = c.courseCode || "NO CODE";
            if (!courses[code]) courses[code] = [];
            courses[code].push({ date: day.date, session: sess.session, c });
        })));

        const courseList = Object.keys(courses).sort();
        if (courseList.length === 0) {
            return res.status(404).json({ message: "No manual plan to export" });
        }

        const wb = xlsx.utils.book_new();
        courseList.forEach(code => {
            const items = courses[code];
            const sessionGroups = [];
            const seen = {};
            items.forEach(item => {
                const key = `${new Date(item.date).toISOString()}|${item.session}`;
                if (!seen[key]) {
                    seen[key] = { date: item.date, session: item.session, committees: [] };
                    sessionGroups.push(seen[key]);
                }
                seen[key].committees.push(item.c);
            });

            const aoa = [[`MA HOC PHAN: ${code}`]];
            sessionGroups.forEach(g => {
                const dd = new Date(g.date);
                const dateLabel = `${dd.getUTCDate()}/${dd.getUTCMonth() + 1}`;
                aoa.push([`Ngay ${dateLabel}`]);
                const row1 = [g.session];
                const row2 = [""];
                const row3 = [""];
                g.committees.forEach(c => {
                    const count = c.thesisIds.length;
                    row1.push(c.principal?.name || "", count, "");
                    row2.push(c.examinator?.name || "", "", "");
                    row3.push(c.supervisor?.name || "", "", "");
                });
                aoa.push(row1, row2, row3);
            });

            const ws = xlsx.utils.aoa_to_sheet(aoa);
            ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 6 }, { wch: 24 }, { wch: 6 }, { wch: 24 }, { wch: 6 }];
            xlsx.utils.book_append_sheet(wb, ws, `Lich LVTN ${code}`);
        });

        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buf);
    } catch (error) {
        console.error("exportManualPlan Error:", error);
        res.status(500).json({ message: "Export error" });
    }
};

module.exports = { getManualPlan, autoPlanManual, saveManualPlan, deleteManualPlan, exportManualPlan };
