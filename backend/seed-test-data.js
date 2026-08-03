const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const User = require("./models/User");
const Semester = require("./models/Semester");
const Thesis = require("./models/Thesis");
const ManualPlan = require("./models/ManualPlan");

dotenv.config();

const PROFESSORS = [
    "Nguyen Van An",
    "Tran Thi Binh",
    "Le Quang Cuong",
    "Pham Minh Dung",
    "Hoang Ngoc Em",
    "Vo Thanh Phong",
    "Dang Thi Giao",
    "Bui Van Hai",
];

const STUDENTS = [
    "Nguyen Xuan Hau", "Le Thi Huong", "Pham Van Khanh", "Tran Thi Lan",
    "Do Minh Long", "Vu Ngoc Mai", "Hoang Anh Nam", "Bui Thi Oanh",
    "Dang Quang Phuc", "Trinh Thi Quyen", "Ngo Van Sang", "Ly Thi Thao",
    "Cao Minh Tri", "Dinh Thi Uyen", "Kieu Van Vinh", "Lam Thi Xuan",
    "Mai Quang Y", "Nghiem Thi Yen", "Ong Van Tai", "Phan Thi Toan",
];

const COURSES = ["SE001", "IT002"];

// (courseIndex, supervisorIndex, title)
const THESES = [
    [0, 0, "Application of machine learning for student dropout prediction"],
    [0, 0, "Building a smart attendance system using face recognition"],
    [0, 0, "Sentiment analysis of Vietnamese e-commerce reviews"],
    [0, 0, "Predicting stock prices with LSTM networks"],
    [0, 0, "Object detection for traffic monitoring systems"],
    [0, 0, "Chatbot for university admission support"],
    [0, 1, "Blockchain-based document verification platform"],
    [0, 1, "Secure file sharing system with end-to-end encryption"],
    [0, 2, "E-commerce website with recommendation engine"],
    [0, 2, "Mobile app for managing personal finances"],
    [0, 2, "Hotel booking system with real-time availability"],
    [0, 2, "Online food ordering and delivery tracking"],
    [1, 0, "IoT platform for smart home automation"],
    [1, 0, "Real-time air quality monitoring dashboard"],
    [1, 3, "Deep learning for medical image classification"],
    [1, 3, "Emotion recognition from speech signals"],
    [1, 3, "Text summarization for Vietnamese news articles"],
    [1, 3, "Handwriting digit recognition with CNNs"],
    [1, 4, "Library management system with RFID"],
    [1, 4, "Online examination platform with anti-cheating"],
    [1, 5, "Vehicle license plate recognition system"],
    [1, 6, "Real-time chat application with WebSocket"],
    [1, 7, "Warehouse inventory tracking with barcode scanning"],
];

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.");

    const password = await bcrypt.hash("password123", 10);

    const profUsers = [];
    for (const name of PROFESSORS) {
        const email = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, ".") + "@example.com";
        let u = await User.findOne({ email });
        if (!u) u = await User.create({ name, email, password, role: "professor" });
        else { u.role = "professor"; u.name = name; await u.save(); }
        profUsers.push(u);
    }

    const studentUsers = [];
    for (const name of STUDENTS) {
        const email = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, ".") + "@student.example.com";
        let u = await User.findOne({ email });
        if (!u) u = await User.create({ name, email, password, role: "student" });
        studentUsers.push(u);
    }

    const semester = await Semester.findOneAndUpdate(
        { name: "HK2 2025-2026" },
        { name: "HK2 2025-2026", displayName: "HK2 2025-2026", isActive: true },
        { upsert: true, new: true }
    );
    await Semester.updateMany({ _id: { $ne: semester._id } }, { isActive: false });

    await Thesis.deleteMany({ semester: semester._id });
    const statuses = ["approved", "approved", "approved", "scheduled", "under_review", "approved", "approved", "approved"];

    let si = 0;
    for (let i = 0; i < THESES.length; i++) {
        const [c, p, title] = THESES[i];
        await Thesis.create({
            student: studentUsers[si++ % studentUsers.length]._id,
            supervisor: profUsers[p]._id,
            semester: semester._id,
            courseCode: COURSES[c],
            title,
            titleEn: title,
            status: statuses[i % statuses.length],
        });
    }

    // Clean any manual plan for the fresh seed semester
    await ManualPlan.deleteMany({ semester: semester._id });

    console.log(`Semester: ${semester.displayName} (${semester._id})`);
    console.log(`Professors: ${profUsers.length}, Students: ${studentUsers.length}, Theses: ${THESES.length}`);
    console.log("Credentials -> Email: admin@example.com / Password: admin123");
    process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
