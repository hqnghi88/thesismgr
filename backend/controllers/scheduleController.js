const Schedule = require("../models/Schedule");
const Thesis = require("../models/Thesis");
const User = require("../models/User");

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
        currentSlot.setHours(9, 0, 0, 0);

        const rooms = ["Room A", "Room B", "Room C"];
        const results = [];

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
                return res.status(400).json({ message: `Cannot find enough unique professors for thesis: ${thesis.title}` });
            }

            const principal = shuffled[0]._id;
            const examinator = shuffled[1]._id;

            // 3. Assign slot and room
            const room = rooms[i % rooms.length];
            const startTime = new Date(currentSlot);
            const endTime = new Date(currentSlot);
            endTime.setHours(startTime.getHours() + 1);

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

            if ((i + 1) % rooms.length === 0) {
                currentSlot.setHours(currentSlot.getHours() + 1);
                if (currentSlot.getHours() >= 17) {
                    currentSlot.setDate(currentSlot.getDate() + 1);
                    currentSlot.setHours(9, 0, 0, 0);
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

module.exports = { autoPlan, getSchedules };
