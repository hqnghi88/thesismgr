const User = require("../models/User");
const Thesis = require("../models/Thesis");
const xlsx = require("xlsx");

const normalizeName = (name) => {
    if (!name) return "";
    // Remove titles like "TS.", "ThS.", "GVC.", "PGS.", "GS." and common prefix patterns
    return name.replace(/^(TS\.|ThS\.|GVC\.|PGS\.|GS\.)\s+/ig, "").trim();
};

const importUsersFromExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const row of data) {
            // Expected columns: Title, Name, Email, Code, Short
            const email = row.Email || row.email;
            const name = row.Name || row.name;

            if (!email || !name) {
                skipped++;
                continue;
            }

            // Check if user already exists
            const existingUser = await User.findOne({ email });

            if (existingUser) {
                // Update existing user
                existingUser.name = name;
                await existingUser.save();
                updated++;
            } else {
                // Create new user with role 'professor' and default password
                const newUser = new User({
                    name,
                    email,
                    password: "password123", // Default password, should be changed on first login
                    role: "professor"
                });
                await newUser.save();
                created++;
            }
        }

        res.status(200).json({
            message: "Import completed successfully",
            created,
            updated,
            skipped,
            total: created + updated
        });
    } catch (error) {
        console.error("Import Users Error:", error);
        res.status(500).json({ message: "Server error during import" });
    }
};

const importThesesFromExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to array of arrays first to find headers
        const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        // Find header row (the one containing MSSV or "Họ tên SV")
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const rowArr = rows[i];
            if (rowArr && rowArr.some(cell => String(cell).includes('MSSV') || String(cell).includes('Họ tên SV'))) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            return res.status(400).json({ message: "Could not find header row in Excel (looking for MSSV or Họ tên SV)" });
        }

        // Re-read data starting from content rows
        const headers = rows[headerRowIndex];
        const dataRows = rows.slice(headerRowIndex + 1);

        let count = 0;
        for (const rowArr of dataRows) {
            if (!rowArr || rowArr.length === 0) continue;

            // Map row array to object using headers
            const row = {};
            headers.forEach((h, idx) => {
                if (h) row[String(h).trim()] = rowArr[idx];
            });

            const mssv = row['MSSV'] || row['MÃ SV'] || row['Mã SV'];
            const studentName = row['Họ tên SV'] || row['Họ và Tên SV'] || row['Student Name'];
            const title = row['Tên đề tài'] || row['Thesis Title'] || row['Tên đề tài (Tiếng Việt và Tiếng Anh)'];
            const supervisorName = row['GVHD'] || row['Người hướng dẫn'] || row['Supervisor'] || row['Cán bộ hướng dẫn'];

            if (!mssv || !studentName || !title || !supervisorName) continue;

            const studentEmail = `${String(mssv).toLowerCase().trim()}@student.ctu.edu.vn`;

            // 1. Handle Student
            let student = await User.findOne({ email: studentEmail });
            if (!student) {
                student = new User({
                    name: String(studentName).trim(),
                    email: studentEmail,
                    password: "password123",
                    role: "student"
                });
                await student.save();
            }

            // 2. Handle Professor (REUSE LOGIC)
            const rawSuperName = String(supervisorName).trim();
            const normalizedTarget = normalizeName(rawSuperName);

            // Search by name (case insensitive containing normalized target)
            let professor = await User.findOne({
                role: 'professor',
                name: { $regex: new RegExp(normalizedTarget, 'i') }
            });

            if (!professor) {
                // Try relaxed search by last parts of name
                const nameParts = normalizedTarget.split(' ');
                if (nameParts.length > 1) {
                    const lastTwo = nameParts.slice(-2).join(' ');
                    professor = await User.findOne({
                        role: 'professor',
                        name: { $regex: new RegExp(lastTwo, 'i') }
                    });
                }
            }

            if (!professor) {
                // Still create if not found, but we tried our best to reuse
                professor = new User({
                    name: rawSuperName,
                    email: `${normalizedTarget.toLowerCase().replace(/\s+/g, '')}@ctu.edu.vn`,
                    password: "password123",
                    role: "professor"
                });
                await professor.save();
            }

            // 3. Create Thesis
            const newThesis = new Thesis({
                student: student._id,
                supervisor: professor._id,
                title: String(title).trim(),
                status: "approved"
            });
            await newThesis.save();
            count++;
        }

        res.status(201).json({ message: "Theses imported successfully", count });
    } catch (error) {
        console.error("Import Theses Error:", error);
        res.status(500).json({ message: "Server error during import" });
    }
};

module.exports = { importUsersFromExcel, importThesesFromExcel };
