const Schedule = require("../models/Schedule");
const Thesis = require("../models/Thesis");
const User = require("../models/User");
const xlsx = require("xlsx");
const mongoose = require("mongoose");

const getConflicts = async (startTime, room, principalId, examinatorId, supervisorId, excludeScheduleId = null) => {
    try {
        const query = {
            startTime,
            _id: { $ne: excludeScheduleId }
        };

        const existing = await Schedule.find(query);

        const conflicts = {
            room: false,
            profs: []
        };

        // Normalize new IDs
        const newProfs = [principalId, examinatorId, supervisorId]
            .map(p => p?.toString())
            .filter(p => p && mongoose.Types.ObjectId.isValid(p));

        existing.forEach(s => {
            if (room && s.room === room) conflicts.room = true;

            // Safely get IDs from existing schedule
            const busyProfs = [s.principal, s.examinator, s.supervisor]
                .map(p => p?.toString())
                .filter(p => p && mongoose.Types.ObjectId.isValid(p));

            newProfs.forEach(p => {
                if (busyProfs.includes(p) && !conflicts.profs.includes(p)) {
                    conflicts.profs.push(p);
                }
            });
        });

        return conflicts;
    } catch (error) {
        console.error("Conflict Check Error:", error);
        return { room: false, profs: [] }; // Fallback
    }
};

const autoPlan = async (req, res) => {
    try {
        console.log("Starting Auto-Planning...");

        // 1. Identify which theses need planning
        const scheduledThesisIds = await Schedule.find().distinct('thesis');
        const thesesToSchedule = await Thesis.find({
            _id: { $nin: scheduledThesisIds },
            status: 'approved'
        });

        // 2. Identify professors
        const professors = await User.find({ role: 'professor' });
        if (professors.length < 3) {
            return res.status(400).json({ message: "Not enough professors available (minimum 3 required)." });
        }

        // 3. Identify and fix partial schedules (missing jury members)
        const allSchedules = await Schedule.find();
        let fixedCount = 0;

        for (const s of allSchedules) {
            if (!s.principal || !s.examinator || !s.supervisor) {
                const busyInSlot = await Schedule.find({ startTime: s.startTime, _id: { $ne: s._id } });
                const busyProfIds = new Set(busyInSlot.flatMap(bs => [
                    bs.principal?.toString(),
                    bs.examinator?.toString(),
                    bs.supervisor?.toString()
                ]).filter(Boolean));

                const excludeIds = new Set(busyProfIds);
                if (s.supervisor) excludeIds.add(s.supervisor.toString());
                if (s.principal) excludeIds.add(s.principal.toString());
                if (s.examinator) excludeIds.add(s.examinator.toString());

                const availablePool = professors.filter(p => !excludeIds.has(p._id.toString()))
                    .sort(() => 0.5 - Math.random());

                let poolIdx = 0;
                let changed = false;

                if (!s.supervisor && poolIdx < availablePool.length) { s.supervisor = availablePool[poolIdx++]._id; changed = true; }
                if (!s.principal && poolIdx < availablePool.length) { s.principal = availablePool[poolIdx++]._id; changed = true; }
                if (!s.examinator && poolIdx < availablePool.length) { s.examinator = availablePool[poolIdx++]._id; changed = true; }

                if (changed) {
                    await s.save();
                    fixedCount++;
                }
            }
        }

        // 4. Zero-Chaos Stable Planning (Fixed-Shift Committees)
        const rooms = ["Room 110/DI", "Room 111/DI", "Room 112/DI", "Room 113/DI"];
        const morningSlots = ["07:15", "07:50", "08:25", "09:00", "09:35", "10:10"];
        const afternoonSlots = ["13:30", "14:05", "14:40", "15:15", "15:50", "16:25"];

        let plannedCount = 0;
        let dayOffset = 1;

        while (plannedCount < thesesToSchedule.length && dayOffset < 30) {
            const currentDay = new Date();
            currentDay.setDate(currentDay.getDate() + dayOffset);
            currentDay.setHours(0, 0, 0, 0);

            for (const room of rooms) {
                for (const shift of [morningSlots, afternoonSlots]) {
                    if (plannedCount >= thesesToSchedule.length) break;

                    // 1. Identify which slots in this shift are actually available in this room
                    let freeSlots = [];
                    for (const slotStr of shift) {
                        const st = new Date(currentDay);
                        const [h, m] = slotStr.split(':');
                        st.setHours(parseInt(h), parseInt(m), 0, 0);
                        const occupied = await Schedule.findOne({ startTime: st, room });
                        if (!occupied) freeSlots.push(st);
                    }

                    if (freeSlots.length === 0) continue;

                    // 2. Pull a batch of pending theses, grouped by supervisor to maintain series
                    let batch = [];
                    let batchSupervisors = new Set();
                    const availableTheses = await Thesis.find({ status: 'approved' }).sort({ supervisor: 1 });

                    for (const t of availableTheses) {
                        if (batch.length < freeSlots.length) {
                            batch.push(t);
                            batchSupervisors.add(t.supervisor.toString());
                        } else break;
                    }

                    if (batch.length === 0) continue;

                    // 3. Find 2 FIXED Committee Members for this shift
                    // Must not be ANY of the supervisors in the batch, and not busy elsewhere in this shift
                    let globallyBusyProfs = new Set();
                    for (const slotTime of freeSlots) {
                        const others = await Schedule.find({ startTime: slotTime });
                        others.forEach(o => {
                            if (o.principal) globallyBusyProfs.add(o.principal.toString());
                            if (o.examinator) globallyBusyProfs.add(o.examinator.toString());
                            if (o.supervisor) globallyBusyProfs.add(o.supervisor.toString());
                        });
                    }

                    const fixedPool = professors.filter(p => {
                        const pid = p._id.toString();
                        return !batchSupervisors.has(pid) && !globallyBusyProfs.has(pid);
                    });

                    if (fixedPool.length >= 2) {
                        const principal = fixedPool[0]._id;
                        const examinator = fixedPool[1]._id;

                        // 4. Create the schedules with the EXACT SAME principal and examinator
                        for (let i = 0; i < batch.length; i++) {
                            const thesis = batch[i];
                            const startTime = freeSlots[i];
                            const endTime = new Date(startTime);
                            endTime.setMinutes(startTime.getMinutes() + 35);

                            await new Schedule({
                                thesis: thesis._id,
                                principal,
                                examinator,
                                supervisor: thesis.supervisor,
                                student: thesis.student,
                                startTime,
                                endTime,
                                room
                            }).save();

                            thesis.status = 'scheduled';
                            await thesis.save();
                            plannedCount++;
                        }
                    }
                }
            }
            dayOffset++;
        }

        res.status(201).json({
            message: "Automatic planning completed",
            scheduled: plannedCount,
            fixed: fixedCount
        });
    } catch (error) {
        console.error("Auto-plan Error:", error);
        res.status(500).json({ message: "Server error during planning" });
    }
};

const getSchedules = async (req, res) => {
    try {
        const schedules = await Schedule.find()
            .populate({
                path: 'thesis',
                populate: { path: 'student supervisor', select: 'name' }
            })
            .populate('principal examinator supervisor student', 'name');
        res.status(200).json(schedules);
    } catch (error) {
        console.error("Get Schedules Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const updateSchedule = async (req, res) => {
    try {
        const { principal, examinator, supervisor, startTime, endTime, room } = req.body;
        const schedule = await Schedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({ message: "Schedule not found" });
        }

        const newStartTime = startTime ? new Date(startTime) : schedule.startTime;
        const newRoom = room || schedule.room;
        const newPrincipal = principal || schedule.principal;
        const newExaminator = examinator || schedule.examinator;
        const newSupervisor = supervisor || schedule.supervisor;

        // IDs to check
        const pId = newPrincipal?.toString();
        const eId = newExaminator?.toString();
        const sId = newSupervisor?.toString();

        if (pId === eId || pId === sId || eId === sId) {
            return res.status(400).json({ message: "All jury members must be different people." });
        }

        const conflicts = await getConflicts(newStartTime, newRoom, newPrincipal, newExaminator, newSupervisor, req.params.id);

        if (conflicts.room) return res.status(400).json({ message: `Room ${newRoom} is occupied.` });
        if (conflicts.profs.length > 0) return res.status(400).json({ message: "Professor conflict detected." });

        if (principal) schedule.principal = principal;
        if (examinator) schedule.examinator = examinator;
        if (supervisor) schedule.supervisor = supervisor;
        if (startTime) schedule.startTime = startTime;
        if (endTime) schedule.endTime = endTime;
        if (room) schedule.room = room;

        await schedule.save();
        res.status(200).json({ message: "Updated successfully", schedule });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const deleteSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.id);
        if (!schedule) return res.status(404).json({ message: "Not found" });

        await Thesis.findByIdAndUpdate(schedule.thesis, { status: 'approved' });
        await Schedule.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Deleted" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const exportSchedules = async (req, res) => {
    try {
        const schedules = await Schedule.find()
            .populate('thesis principal examinator supervisor student', 'name email title startTime');

        if (schedules.length === 0) return res.status(404).json({ message: "No data" });

        const rows = [["STT", "MSSV", "Họ tên SV", "Tên đề tài", "GVHD", "Giờ", "Hội đồng"]];
        schedules.forEach((s, i) => {
            const studentId = s.student?.email?.split('@')[0].toUpperCase() || "";
            const jury = `1. ${s.principal?.name}\n2. ${s.examinator?.name}\n3. ${s.supervisor?.name}`;
            const time = new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            rows.push([i + 1, studentId, s.student?.name || "", s.thesis?.title || "", s.supervisor?.name || "", time, jury]);
        });

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 20 }, { wch: 50 }, { wch: 20 }, { wch: 10 }, { wch: 40 }];
        xlsx.utils.book_append_sheet(wb, ws, "Jury");
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="schedule.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) {
        res.status(500).json({ message: "Export error" });
    }
};

const deleteAllSchedules = async (req, res) => {
    try {
        await Schedule.deleteMany({});
        await Thesis.updateMany({}, { status: 'approved' });
        res.status(200).json({ message: "Cleared all planned schedules" });
    } catch (error) {
        console.error("Delete All Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { autoPlan, getSchedules, updateSchedule, deleteSchedule, exportSchedules, deleteAllSchedules };
