const Schedule = require("../models/Schedule");
const Thesis = require("../models/Thesis");
const User = require("../models/User");
const xlsx = require("xlsx");

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

        let currentSlot = new Date();
        currentSlot.setDate(currentSlot.getDate() + 1);
        currentSlot.setHours(7, 15, 0, 0); // Start at 07:15

        const rooms = ["Room 110/DI", "Room 111/DI"];
        const results = [];
        let slotCountLocal = 0; // To track slots in a day

        for (let i = 0; i < thesesToSchedule.length; i++) {
            const thesis = thesesToSchedule[i];

            // 1. Identify Supervisor and Student
            const supervisor = thesis.supervisor;
            const student = thesis.student;

            // 2. Select Principal and Examinator from other professors
            const otherProfs = professors.filter(p => p._id.toString() !== supervisor.toString());

            // Shuffle to randomize
            const shuffled = otherProfs.sort(() => 0.5 - Math.random());

            if (shuffled.length < 2) {
                return res.status(400).json({ message: `Not enough professors to form a jury for: ${thesis.title}` });
            }

            const principal = shuffled[0]._id;
            const examinator = shuffled[1]._id;

            // 3. Assign slot and room
            const room = rooms[Math.floor(slotCountLocal / 8) % rooms.length]; // Swap room every 8 slots or so, simplified
            const startTime = new Date(currentSlot);
            const endTime = new Date(currentSlot);
            endTime.setMinutes(startTime.getMinutes() + 35); // 35 minutes per slot

            const newSchedule = new Schedule({
                thesis: thesis._id,
                principal,
                examinator,
                supervisor,
                student,
                startTime,
                endTime,
                room
            });

            await newSchedule.save();

            thesis.status = 'scheduled';
            await thesis.save();

            results.push(newSchedule);

            // 4. Update currentSlot for next thesis
            slotCountLocal++;
            currentSlot.setMinutes(currentSlot.getMinutes() + 35);

            // Check for break/shift change
            const hours = currentSlot.getHours();
            const minutes = currentSlot.getMinutes();
            const totalMinutes = hours * 60 + minutes;

            // Morning shift ends around 11:20 (7 slots: 07:15, 07:50, 08:25, 09:00, 09:35, 10:10, 10:45 -> 11:20)
            // If we hit roughly 12:00 or more, jump to afternoon shift 13:30
            if (totalMinutes > 11 * 60 + 20 && totalMinutes < 13 * 60 + 30) {
                currentSlot.setHours(13, 30, 0, 0);
            }
            // If we hit after 17:35, jump to next day 07:15
            else if (totalMinutes > 17 * 60 + 35) {
                currentSlot.setDate(currentSlot.getDate() + 1);
                currentSlot.setHours(7, 15, 0, 0);
                slotCountLocal = 0;
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

