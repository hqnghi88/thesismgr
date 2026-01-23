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
        const scheduledThesisIds = await Schedule.find().distinct('thesis');
        const thesesToSchedule = await Thesis.find({
            _id: { $nin: scheduledThesisIds },
            status: 'approved'
        });

        if (thesesToSchedule.length === 0) {
            return res.status(200).json({ message: "No approved theses to schedule." });
        }

        const professors = await User.find({ role: 'professor' });
        if (professors.length < 3) {
            return res.status(400).json({ message: "Not enough professors available (minimum 3 required)." });
        }

        const rooms = ["Room 110/DI", "Room 111/DI"];
        const results = [];

        // Start from tomorrow at 07:15
        let currentSlot = new Date();
        currentSlot.setDate(currentSlot.getDate() + 1);
        currentSlot.setHours(7, 15, 0, 0);

        for (const thesis of thesesToSchedule) {
            let found = false;
            const supervisorId = thesis.supervisor;

            // Loop until we find a valid slot
            while (!found) {
                // Try each room for this time slot
                for (const room of rooms) {
                    // Check if supervisor is available and room is free
                    const conflicts = await getConflicts(currentSlot, room, null, null, supervisorId);

                    if (!conflicts.room && !conflicts.profs.includes(supervisorId.toString())) {
                        // Supervisor is free and room is free. Now find 2 other free professors.
                        const busyInSlot = await Schedule.find({ startTime: currentSlot });
                        const busyProfIds = new Set(busyInSlot.flatMap(s => [
                            s.principal.toString(),
                            s.examinator.toString(),
                            s.supervisor.toString()
                        ]));
                        busyProfIds.add(supervisorId.toString());

                        const availableProfs = professors.filter(p => !busyProfIds.has(p._id.toString()));

                        // Shuffle to randomize
                        availableProfs.sort(() => 0.5 - Math.random());

                        if (availableProfs.length >= 2) {
                            const principal = availableProfs[0]._id;
                            const examinator = availableProfs[1]._id;

                            const startTime = new Date(currentSlot);
                            const endTime = new Date(currentSlot);
                            endTime.setMinutes(startTime.getMinutes() + 35);

                            const newSchedule = new Schedule({
                                thesis: thesis._id,
                                principal,
                                examinator,
                                supervisor: supervisorId,
                                student: thesis.student,
                                startTime,
                                endTime,
                                room
                            });

                            await newSchedule.save();
                            thesis.status = 'scheduled';
                            await thesis.save();
                            results.push(newSchedule);
                            found = true;
                            break; // Exit room loop
                        }
                    }
                }

                if (!found) {
                    // Move to next time slot
                    currentSlot.setMinutes(currentSlot.getMinutes() + 35);

                    const hours = currentSlot.getHours();
                    const minutes = currentSlot.getMinutes();
                    const totalMinutes = hours * 60 + minutes;

                    // Morning shift ends around 11:20, jump to afternoon 13:30
                    if (totalMinutes > 11 * 60 + 20 && totalMinutes < 13 * 60 + 30) {
                        currentSlot.setHours(13, 30, 0, 0);
                    }
                    // If after 17:35, jump to next day 07:15
                    else if (totalMinutes > 17 * 60 + 35) {
                        currentSlot.setDate(currentSlot.getDate() + 1);
                        currentSlot.setHours(7, 15, 0, 0);
                    }
                }
            }
        }

        res.status(201).json({ message: "Automatic planning completed", scheduled: results });
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

module.exports = { autoPlan, getSchedules, updateSchedule, deleteSchedule, exportSchedules };
