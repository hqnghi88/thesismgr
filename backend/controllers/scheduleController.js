const Schedule = require("../models/Schedule");
const Thesis = require("../models/Thesis");
const User = require("../models/User");
const xlsx = require("xlsx");
const mongoose = require("mongoose");
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, BorderStyle, HeadingLevel, VerticalAlign, PageOrientation } = require("docx");
const fs = require("fs");

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
        const { roomCount } = req.body;
        const defaultRooms = ["Room 110/DI", "Room 111/DI", "Room 112/DI", "Room 113/DI"];
        const rooms = roomCount ? defaultRooms.slice(0, parseInt(roomCount)) : defaultRooms;
        const morningSlots = ["07:15", "07:50", "08:25", "09:00", "09:35", "10:10"];
        const afternoonSlots = ["13:30", "14:05", "14:40", "15:15", "15:50", "16:25"];

        let plannedCount = 0;
        const TZ_OFFSET = 7; // Vietnam Time

        // 5. Execution Loop
        for (const sId of sortedSIds) {
            const theses = supervisorGroups[sId];
            let thesisIdx = 0;

            while (thesisIdx < theses.length) {
                const remaining = theses.length - thesisIdx;
                const batchSize = Math.min(remaining, 6);
                const currentBatch = theses.slice(thesisIdx, thesisIdx + batchSize);

                let placed = false;
                let dayOffset = 1; // Start from tomorrow to ensure full shifts

                while (!placed && dayOffset < 30) {
                    const searchDay = new Date();
                    searchDay.setDate(searchDay.getDate() + dayOffset);
                    searchDay.setUTCHours(0, 0, 0, 0); // Use UTC to avoid double-shifting

                    searchLoop: for (const room of rooms) {
                        for (const shift of [morningSlots, afternoonSlots]) {

                            let availableSlots = [];
                            for (const slotStr of shift) {
                                const st = new Date(searchDay);
                                const [h, m] = slotStr.split(':');
                                // Adjust to UTC to represent the local time correctly in the DB
                                st.setUTCHours(parseInt(h) - TZ_OFFSET, parseInt(m), 0, 0);

                                // Skip if slot is in the past
                                if (st < new Date()) continue;

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

const exportDocx = async (req, res) => {
    try {
        const schedules = await Schedule.find()
            .populate('thesis principal examinator supervisor student')
            .sort({ startTime: 1, room: 1 });

        if (schedules.length === 0) return res.status(404).json({ message: "No data to export" });

        const groups = {};
        schedules.forEach(s => {
            const d = new Date(s.startTime);
            const dateStr = d.toLocaleDateString('vi-VN');
            if (!groups[dateStr]) groups[dateStr] = {};
            if (!groups[dateStr][s.room]) groups[dateStr][s.room] = [];
            groups[dateStr][s.room].push(s);
        });

        const children = [];

        // Header
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "ĐẠI HỌC CẦN THƠ", bold: true, size: 24 })],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "TRƯỜNG CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG", bold: true, size: 24 })],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "DANH SÁCH HỘI ĐỒNG BẢO VỆ LUẬN VĂN TỐT NGHIỆP", bold: true, size: 28 })],
                spacing: { before: 200 }
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Khoa: Công nghệ phần mềm", italic: true, size: 24 })],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "(Kèm theo quyết định số           /QĐ-CNTT&TT ngày     /      /2025)", size: 22 })],
            }),
            new Paragraph({
                children: [new TextRun({ text: "Ghi chú: Vai trò các thành viên Hội đồng : (1) – Chủ tịch, (2) – Ủy viên, (3) – Thư ký", italic: true, size: 18 })],
                spacing: { before: 200, after: 200 }
            })
        );

        Object.keys(groups).forEach(date => {
            Object.keys(groups[date]).forEach(room => {
                children.push(new Paragraph({
                    children: [new TextRun({ text: `Ngày ${date} - ${room.replace('Room', 'Phòng')}`, bold: true, size: 24, underline: {} })],
                    spacing: { before: 300, after: 150 }
                }));

                const tableRows = [
                    new TableRow({
                        tableHeader: true,
                        children: [
                            new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "STT", bold: true, size: 20 })] })] }),
                            new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MSSV", bold: true, size: 20 })] })] }),
                            new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Họ tên SV", bold: true, size: 20 })] })] }),
                            new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Tên đề tài", bold: true, size: 20 })] })] }),
                            new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "GVHD", bold: true, size: 20 })] })] }),
                            new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Giờ bảo vệ", bold: true, size: 20 })] })] }),
                            new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Hội đồng", bold: true, size: 20 })] })] }),
                        ],
                    })
                ];

                groups[date][room].forEach((s, idx) => {
                    const timeStr = new Date(s.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');

                    tableRows.push(new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ text: (idx + 1).toString(), alignment: AlignmentType.CENTER })] }),
                            new TableCell({ children: [new Paragraph({ text: s.student?.email?.split('@')[0].toUpperCase() || "-" })] }),
                            new TableCell({ children: [new Paragraph({ text: s.student?.name || "-" })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.thesis?.title || "-", size: 18 })] })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.supervisor?.name || "-", size: 18 })] })] }),
                            new TableCell({ children: [new Paragraph({ text: timeStr, alignment: AlignmentType.CENTER })] }),
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: [
                                            new TextRun({ text: `1. ${s.principal?.name || "-"}`, size: 18 }),
                                            new TextRun({ text: "", break: 1 }),
                                            new TextRun({ text: `2. ${s.examinator?.name || "-"}`, size: 18 }),
                                            new TextRun({ text: "", break: 1 }),
                                            new TextRun({ text: `3. ${s.supervisor?.name || "-"}`, size: 18 }),
                                        ]
                                    })
                                ]
                            }),
                        ]
                    }));
                });

                children.push(new Table({
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE,
                    },
                    columnWidths: [600, 1200, 2000, 4800, 2000, 1000, 3000],
                    rows: tableRows,
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 4 },
                        bottom: { style: BorderStyle.SINGLE, size: 4 },
                        left: { style: BorderStyle.SINGLE, size: 4 },
                        right: { style: BorderStyle.SINGLE, size: 4 },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 4 },
                        insideVertical: { style: BorderStyle.SINGLE, size: 4 },
                    }
                }));
            });
        });

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 720, bottom: 720, left: 720, right: 720 },
                        size: {
                            width: 16838, // A4 Landscape width
                            height: 11906, // A4 Landscape height
                        },
                        orientation: PageOrientation.LANDSCAPE,
                    },
                },
                children: children,
            }],
        });

        const buffer = await Packer.toBuffer(doc);
        res.setHeader('Content-Disposition', 'attachment; filename="ListHoiDong.docx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buffer);
    } catch (error) {
        console.error("Export Docx Error:", error);
        res.status(500).json({ message: "DOCX Export error" });
    }
};

module.exports = { autoPlan, getSchedules, updateSchedule, deleteSchedule, exportSchedules, exportDocx, deleteAllSchedules };
