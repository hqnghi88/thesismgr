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

        const newProfs = [principalId, examinatorId, supervisorId]
            .map(p => p?.toString())
            .filter(p => p && mongoose.Types.ObjectId.isValid(p));

        existing.forEach(s => {
            if (room && s.room === room) conflicts.room = true;

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
        return { room: false, profs: [] };
    }
};

const autoPlan = async (req, res) => {
    try {
        console.log("Starting DETERMINISTIC Auto-Planning v5...");

        // 1. Identify which theses need planning
        const scheduledThesisIds = await Schedule.find().distinct('thesis');
        const thesesToSchedule = await Thesis.find({
            _id: { $nin: scheduledThesisIds },
            status: 'approved'
        }).populate('supervisor student');

        if (thesesToSchedule.length === 0) {
            return res.status(200).json({ message: "No theses to schedule.", scheduled: 0 });
        }

        // 2. Identify professors - SORT BY NAME/ID TO REMOVE RANDOMNESS
        // This ensures we always try to use the same subset of professors first (Minimizing Chaos)
        const professors = await User.find({ role: 'professor' }).sort({ _id: 1 });
        if (professors.length < 3) {
            return res.status(400).json({ message: "Not enough professors available." });
        }

        // 3. Group by Supervisor
        const supervisorGroups = {};
        thesesToSchedule.forEach(t => {
            const sId = t.supervisor?._id.toString();
            if (!supervisorGroups[sId]) supervisorGroups[sId] = [];
            supervisorGroups[sId].push(t);
        });

        // Sort supervisors by load (high to low)
        const sortedSIds = Object.keys(supervisorGroups).sort((a, b) => supervisorGroups[b].length - supervisorGroups[a].length);

        // 4. Constants
        const rooms = ["Room 110/DI", "Room 111/DI", "Room 112/DI", "Room 113/DI"];
        const morningSlots = ["07:15", "07:50", "08:25", "09:00", "09:35", "10:10"];
        const afternoonSlots = ["13:30", "14:05", "14:40", "15:15", "15:50", "16:25"];

        let plannedCount = 0;

        // 5. Execution Loop
        for (const sId of sortedSIds) {
            const theses = supervisorGroups[sId];
            let thesisIdx = 0;

            while (thesisIdx < theses.length) {
                const remaining = theses.length - thesisIdx;
                const batchSize = Math.min(remaining, 6); // Try to schedule up to 6 in a row
                const currentBatch = theses.slice(thesisIdx, thesisIdx + batchSize);

                let placed = false;
                let dayOffset = 1;

                while (!placed && dayOffset < 30) {
                    const searchDay = new Date();
                    searchDay.setDate(searchDay.getDate() + dayOffset);
                    searchDay.setHours(0, 0, 0, 0);

                    searchLoop: for (const room of rooms) {
                        for (const shift of [morningSlots, afternoonSlots]) {

                            // Check for 'batchSize' FREE slots in this shift
                            let availableSlots = [];
                            for (const slotStr of shift) {
                                const st = new Date(searchDay);
                                const [h, m] = slotStr.split(':');
                                st.setHours(parseInt(h), parseInt(m), 0, 0);

                                const occupied = await Schedule.findOne({ startTime: st, room });
                                if (!occupied) {
                                    availableSlots.push(st);
                                }
                            }

                            // We need exactly 'batchSize' contiguous/available slots? 
                            // Actually, just 'batchSize' slots in the shift is enough for our requirements, 
                            // provided we lock the committee. They don't have to be technically contiguous if there's a gap,
                            // but usually they will be in an empty room.

                            if (availableSlots.length >= batchSize) {
                                // Found valid space for the whole batch. 
                                // Now pick 2 professors who are free for ALL of these specific slots.

                                let busyProfIds = new Set();
                                const slotsToUse = availableSlots.slice(0, batchSize);

                                for (const st of slotsToUse) {
                                    const others = await Schedule.find({ startTime: st });
                                    others.forEach(o => {
                                        if (o.principal) busyProfIds.add(o.principal.toString());
                                        if (o.examinator) busyProfIds.add(o.examinator.toString());
                                        if (o.supervisor) busyProfIds.add(o.supervisor.toString());
                                    });
                                }

                                // Deterministic Selection: Always pick the first 2 available professors from our sorted list.
                                // This satisfies: "Use as needed number", "Don't use all if not needed"
                                const candidatePool = professors.filter(p => {
                                    const pid = p._id.toString();
                                    return pid !== sId && !busyProfIds.has(pid);
                                });

                                if (candidatePool.length >= 2) {
                                    // Lock the committee
                                    const principalId = candidatePool[0]._id;
                                    const examinatorId = candidatePool[1]._id;

                                    // Save the batch
                                    for (let i = 0; i < batchSize; i++) {
                                        const thesis = currentBatch[i];
                                        const startTime = slotsToUse[i];
                                        const endTime = new Date(startTime);
                                        endTime.setMinutes(startTime.getMinutes() + 35);

                                        const newSched = new Schedule({
                                            thesis: thesis._id,
                                            principal: principalId,
                                            examinator: examinatorId,
                                            supervisor: thesis.supervisor._id,
                                            student: thesis.student._id,
                                            startTime,
                                            endTime,
                                            room
                                        });
                                        await newSched.save();

                                        thesis.status = 'scheduled';
                                        await thesis.save();
                                        plannedCount++;
                                    }
                                    placed = true;
                                    thesisIdx += batchSize;
                                    break searchLoop;
                                }
                            }
                        }
                    }
                    dayOffset++;
                }
                if (!placed) {
                    // Force break if we can't schedule this supervisor to avoid infinite loop
                    console.error("Could not schedule for supervisor " + sId);
                    break;
                }
            }
        }

        res.status(201).json({
            message: "Automatic planning completed with Deterministic Juries.",
            scheduled: plannedCount
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
