const xlsx = require('xlsx');
const User = require('../models/User');
const Thesis = require('../models/Thesis');
const bcrypt = require('bcryptjs');

const importExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        // Assuming row 4 (index 4) is header, data starts index 5
        const dataRows = rows.slice(5);
        const results = [];

        for (const row of dataRows) {
            if (!row || row.length < 8) continue;

            const studentId = row[1];
            const studentName = row[2];
            const supervisorName = row[6];
            const thesisTitle = row[7];
            const englishTitle = row[8];

            if (!studentId || !studentName || !supervisorName || !thesisTitle) continue;

            // 1. Find or create Supervisor (Professor)
            let supervisor = await User.findOne({ name: supervisorName, role: 'professor' });
            if (!supervisor) {
                const dummyEmail = `${supervisorName.toLowerCase().replace(/\s+/g, '.')}@ctu.edu.vn`;
                const hashedPassword = await bcrypt.hash("123456", 10);
                supervisor = new User({
                    name: supervisorName,
                    email: dummyEmail, // In a real app, this should be verified
                    password: hashedPassword,
                    role: 'professor'
                });
                await supervisor.save();
            }

            // 2. Find or create Student
            let student = await User.findOne({ email: `${studentId.toLowerCase()}@student.ctu.edu.vn` });
            if (!student) {
                const hashedPassword = await bcrypt.hash("123456", 10);
                student = new User({
                    name: studentName,
                    email: `${studentId.toLowerCase()}@student.ctu.edu.vn`,
                    password: hashedPassword,
                    role: 'student'
                });
                await student.save();
            }

            // 3. Create Thesis
            const existingThesis = await Thesis.findOne({ student: student._id });
            if (!existingThesis) {
                const newThesis = new Thesis({
                    student: student._id,
                    supervisor: supervisor._id,
                    title: thesisTitle,
                    abstract: englishTitle || "",
                    status: 'approved' // Automatically approve imported theses
                });
                await newThesis.save();
                results.push(newThesis);
            }
        }

        res.status(200).json({
            message: "Import completed successfully",
            count: results.length
        });

    } catch (error) {
        console.error("Import Error:", error);
        res.status(500).json({ message: "Server error during import" });
    }
};

module.exports = { importExcel };
