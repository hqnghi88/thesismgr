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

        // 4. Plan new theses
        const rooms = ["Room 110/DI", "Room 111/DI", "Room 112/DI", "Room 113/DI"];
        let plannedCount = 0;

        if (thesesToSchedule.length > 0) {
            let currentSlot = new Date();
            currentSlot.setDate(currentSlot.getDate() + 1);
            currentSlot.setHours(7, 15, 0, 0);

            for (const thesis of thesesToSchedule) {
                let found = false;
                const supervisorId = thesis.supervisor?.toString();
                if (!supervisorId) continue;

                while (!found) {
                    for (const room of rooms) {
                        const conflicts = await getConflicts(currentSlot, room, null, null, supervisorId);

                        if (!conflicts.room && !conflicts.profs.includes(supervisorId)) {
                            const busyInSlot = await Schedule.find({ startTime: currentSlot });
                            const busyProfIds = new Set(busyInSlot.flatMap(s => [
                                s.principal?.toString(),
                                s.examinator?.toString(),
                                s.supervisor?.toString()
                            ]).filter(Boolean));

                            const excludeIds = new Set(busyProfIds);
                            excludeIds.add(supervisorId);

                            const pool = professors.filter(p => !excludeIds.has(p._id.toString()))
                                .sort(() => 0.5 - Math.random());

                            if (pool.length >= 2) {
                                const startTime = new Date(currentSlot);
                                const endTime = new Date(currentSlot);
                                endTime.setMinutes(startTime.getMinutes() + 35);

                                const newSchedule = new Schedule({
                                    thesis: thesis._id,
                                    principal: pool[0]._id,
                                    examinator: pool[1]._id,
                                    supervisor: thesis.supervisor,
                                    student: thesis.student,
                                    startTime,
                                    endTime,
                                    room
                                });

                                await newSchedule.save();
                                thesis.status = 'scheduled';
                                await thesis.save();
                                plannedCount++;
                                found = true;
                                break;
                            }
                        }
                    }

                    if (!found) {
                        currentSlot.setMinutes(currentSlot.getMinutes() + 35);
                        const totalMinutes = currentSlot.getHours() * 60 + currentSlot.getMinutes();
                        // Morning shift ends 11:20
                        if (totalMinutes > 11 * 60 + 20 && totalMinutes < 13 * 60 + 30) {
                            currentSlot.setHours(13, 30, 0, 0);
                        }
                        // Evening ends 17:35
                        else if (totalMinutes > 17 * 60 + 35) {
                            currentSlot.setDate(currentSlot.getDate() + 1);
                            currentSlot.setHours(7, 15, 0, 0);
                        }
                    }
                }
            }
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
