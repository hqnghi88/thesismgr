const User = require("../models/User");
const xlsx = require("xlsx");

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

module.exports = { importUsersFromExcel };
