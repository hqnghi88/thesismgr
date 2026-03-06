const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const User = require("./models/User");

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for seeding...");

        const adminEmail = "admin@example.com";
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log("Admin user already exists. Updating to ensure admin role and password...");
            existingAdmin.role = "admin";
            existingAdmin.password = await bcrypt.hash("admin123", 10);
            await existingAdmin.save();
            console.log("Admin user updated successfully.");
        } else {
            const hashedPassword = await bcrypt.hash("admin123", 10);
            const admin = new User({
                name: "System Admin",
                email: adminEmail,
                password: hashedPassword,
                role: "admin",
            });
            await admin.save();
            console.log("Admin user created successfully.");
        }

        console.log("Credentials:");
        console.log("Email: admin@example.com");
        console.log("Password: admin123");

        process.exit(0);
    } catch (error) {
        console.error("Seeding error:", error);
        process.exit(1);
    }
};

seedAdmin();
