const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Semester = require("./models/Semester");
const Thesis = require("./models/Thesis");

dotenv.config();

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // 1. Create HK2 2025-2026 semester if it doesn't exist
        let hk2 = await Semester.findOne({ name: "HK2-2025-2026" });
        if (!hk2) {
            hk2 = new Semester({
                name: "HK2-2025-2026",
                displayName: "Học kỳ 2 - Năm học 2025-2026",
                isActive: true,
            });
            await hk2.save();
            console.log("Created semester: HK2-2025-2026");
        } else {
            console.log("Semester HK2-2025-2026 already exists");
        }

        // 2. Assign all theses without a semester to HK2
        const result = await Thesis.updateMany(
            { semester: { $exists: false } },
            { $set: { semester: hk2._id } }
        );
        console.log(`Migrated ${result.modifiedCount} theses to HK2-2025-2026`);

        // 3. Verify
        const total = await Thesis.countDocuments();
        const migrated = await Thesis.countDocuments({ semester: hk2._id });
        console.log(`Total theses: ${total}, Assigned to HK2: ${migrated}`);

        console.log("\nMigration complete!");
        process.exit(0);
    } catch (error) {
        console.error("Migration error:", error);
        process.exit(1);
    }
};

migrate();
