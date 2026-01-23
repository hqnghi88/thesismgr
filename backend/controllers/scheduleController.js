const Schedule = require("../models/Schedule");
const Thesis = require("../models/Thesis");
const User = require("../models/User");
const xlsx = require("xlsx");

const getConflicts = async (startTime, room, principalId, examinatorId, supervisorId, excludeScheduleId = null) => {
    const query = {
        startTime,
        _id: { $ne: excludeScheduleId }
    };

    const existing = await Schedule.find(query);

    const conflicts = {
        room: false,
        profs: []
    };

    const newProfs = [principalId?.toString(), examinatorId?.toString(), supervisorId?.toString()].filter(Boolean);

    existing.forEach(s => {
        if (room && s.room === room) conflicts.room = true;

        const busyProfs = [s.principal.toString(), s.examinator.toString(), s.supervisor.toString()];
        newProfs.forEach(p => {
            if (busyProfs.includes(p) && !conflicts.profs.includes(p)) {
                conflicts.profs.push(p);
            }
        });
    });

    return conflicts;
};

const autoPlan = async (req, res) => {
    try {
        // 1. Identify which theses need planning
        const scheduledThesisIds = await Schedule.find().distinct('thesis');
        const thesesToSchedule = await Thesis.find({
            _id: { $nin: scheduledThesisIds },
            status: 'approved'
        });

        // 2. Identify existing tentative schedules with missing jury members
        const partialSchedules = await Schedule.find({
            $or: [
                { principal: { $exists: false } }, { principal: null },
                { examinator: { $exists: false } }, { examinator: null },
                { supervisor: { $exists: false } }, { supervisor: null }
            ]
        });

        const professors = await User.find({ role: 'professor' });
        if (professors.length < 3) {
            return res.status(400).json({ message: "Not enough professors available (minimum 3 required)." });
        }

        const rooms = ["Room 110/DI", "Room 111/DI"];
        const results = [];
        const updatedSchedules = [];

        // --- Task A: Fix Partial/Broken Schedules ---
        for (const s of partialSchedules) {
            const busyInSlot = await Schedule.find({ startTime: s.startTime, _id: { $ne: s._id } });
            const busyProfIds = new Set(busyInSlot.flatMap(bs => [
                bs.principal?.toString(),
                bs.examinator?.toString(),
                bs.supervisor?.toString()
            ]).filter(Boolean));

            // Must exclude everyone already in the jury or busy in slot
            const excludeIds = new Set(busyProfIds);
            if (s.supervisor) excludeIds.add(s.supervisor.toString());
            if (s.principal) excludeIds.add(s.principal.toString());
            if (s.examinator) excludeIds.add(s.examinator.toString());

            const pool = professors.filter(p => !excludeIds.has(p._id.toString()))
                .sort(() => 0.5 - Math.random());

            let poolIdx = 0;
            if (!s.supervisor && poolIdx < pool.length) s.supervisor = pool[poolIdx++]._id;
            if (!s.principal && poolIdx < pool.length) s.principal = pool[poolIdx++]._id;
            if (!s.examinator && poolIdx < pool.length) s.examinator = pool[poolIdx++]._id;

            await s.save();
            updatedSchedules.push(s);
        }

        // --- Task B: Plan New Theses ---
        if (thesesToSchedule.length > 0) {
            // Start from tomorrow at 07:15
            let currentSlot = new Date();
            currentSlot.setDate(currentSlot.getDate() + 1);
            currentSlot.setHours(7, 15, 0, 0);

            for (const thesis of thesesToSchedule) {
                let found = false;
                const supervisorId = thesis.supervisor?.toString();

                if (!supervisorId) continue; // Skip if data is corrupted

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

                            // Exclude supervisor and anyone busy
                            const excludeIds = new Set(busyProfIds);
                            excludeIds.add(supervisorId);

                            const availableProfs = professors.filter(p => !excludeIds.has(p._id.toString()))
                                .sort(() => 0.5 - Math.random());

                            if (availableProfs.length >= 2) {
                                const newSchedule = new Schedule({
                                    thesis: thesis._id,
                                    principal: availableProfs[0]._id,
                                    examinator: availableProfs[1]._id,
                                    supervisor: thesis.supervisor,
                                    student: thesis.student,
                                    startTime: new Date(currentSlot),
                                    endTime: new Date(new Date(currentSlot).setMinutes(currentSlot.getMinutes() + 35)),
                                    room
                                });

                                await newSchedule.save();
                                thesis.status = 'scheduled';
                                await thesis.save();
                                results.push(newSchedule);
                                found = true;
                                break;
                            }
                        }
                    }

                    if (!found) {
                        currentSlot.setMinutes(currentSlot.getMinutes() + 35);
                        const totalMinutes = currentSlot.getHours() * 60 + currentSlot.getMinutes();
                        if (totalMinutes > 11 * 60 + 20 && totalMinutes < 13 * 60 + 30) {
                            currentSlot.setHours(13, 30, 0, 0);
                        } else if (totalMinutes > 17 * 60 + 35) {
                            currentSlot.setDate(currentSlot.getDate() + 1);
                            currentSlot.setHours(7, 15, 0, 0);
                        }
                    }
                }
            }
        }

        res.status(201).json({
            message: "Automatic planning completed",
            scheduled: results.length,
            fixed: updatedSchedules.length
        });
    } catch (error) {
        console.error("Auto-plan Error:", error.message);
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

        // Check for conflicts if time, room, or jury members changed
        const newStartTime = startTime ? new Date(startTime) : schedule.startTime;
        const newRoom = room || schedule.room;
        const newPrincipal = principal || schedule.principal;
        const newExaminator = examinator || schedule.examinator;
        const newSupervisor = supervisor || schedule.supervisor;

        // Validate that all jury members are unique
        const juryMembers = [
            newPrincipal.toString(),
            newExaminator.toString(),
            newSupervisor.toString()
        ];
        const uniqueMembers = new Set(juryMembers);
        if (uniqueMembers.size !== juryMembers.length) {
            return res.status(400).json({ message: "All jury members (Principal, Examinator, Supervisor) must be different people." });
        }

        const conflicts = await getConflicts(newStartTime, newRoom, newPrincipal, newExaminator, newSupervisor, req.params.id);

        if (conflicts.room) {
            return res.status(400).json({ message: `Room ${newRoom} is already occupied at this time.` });
        }
        if (conflicts.profs.length > 0) {
            return res.status(400).json({ message: "One or more professors are already assigned to another jury at this time." });
        }

        // Update fields
        if (principal) schedule.principal = principal;
        if (examinator) schedule.examinator = examinator;
        if (supervisor) schedule.supervisor = supervisor;
        if (startTime) schedule.startTime = startTime;
        if (endTime) schedule.endTime = endTime;
        if (room) schedule.room = room;

        await schedule.save();
        res.status(200).json({ message: "Schedule updated successfully", schedule });
    } catch (error) {
        console.error("Update Schedule Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const deleteSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.id);
        if (!schedule) return res.status(404).json({ message: "Schedule not found" });

        // Change thesis status back to approved
        await Thesis.findByIdAndUpdate(schedule.thesis, { status: 'approved' });

        await Schedule.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Schedule deleted successfully" });
    } catch (error) {
        console.error("Delete Schedule Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const exportSchedules = async (req, res) => {
    try {
        const schedules = await Schedule.find()
            .populate('thesis')
            .populate('principal', 'name')
            .populate('examinator', 'name')
            .populate('supervisor', 'name')
            .populate('student', 'name email');

        if (schedules.length === 0) {
            return res.status(404).json({ message: "No schedules found to export." });
        }

        // Header matching juries.xlsx
        const rows = [
            ["STT", "MSSV", "Họ tên SV", "Tên đề tài (Tiếng Việt và Tiếng Anh)", "Cán bộ hướng dẫn", "Giờ", "Thành viên Hội đồng"]
        ];

        schedules.forEach((s, index) => {
            const studentId = s.student?.email?.split('@')[0].toUpperCase() || "";
            const juryStr = `1. ${s.principal?.name}\n2. ${s.examinator?.name}\n3. ${s.supervisor?.name}`;
            const timeStr = new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

            rows.push([
                index + 1,
                studentId,
                s.student?.name || "",
                s.thesis?.title || "",
                s.supervisor?.name || "",
                timeStr,
                juryStr
            ]);
        });

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(rows);

        // Adjust column widths for readability
        ws['!cols'] = [
            { wch: 5 },  // STT
            { wch: 10 }, // MSSV
            { wch: 25 }, // Họ tên SV
            { wch: 60 }, // Tên đề tài
            { wch: 25 }, // Cán bộ hướng dẫn
            { wch: 10 }, // Giờ
            { wch: 40 }, // Thành viên Hội đồng
        ];

        xlsx.utils.book_append_sheet(wb, ws, "Jury Schedule");
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="jury_schedule_export.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);

    } catch (error) {
        console.error("Export Error:", error);
        res.status(500).json({ message: "Server error during export" });
    }
};

const deleteAllSchedules = async (req, res) => {
    try {
        const result = await Schedule.deleteMany({});
        // Also update all theses status back to approved
        await Thesis.updateMany({}, { status: 'approved' });
        res.status(200).json({ message: `Successfully deleted ${result.deletedCount} schedules` });
    } catch (error) {
        console.error("Delete All Schedules Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { autoPlan, getSchedules, updateSchedule, deleteSchedule, exportSchedules, deleteAllSchedules };
