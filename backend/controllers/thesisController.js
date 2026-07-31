const Thesis = require("../models/Thesis");

const createThesis = async (req, res) => {
    try {
        const { title, titleEn, abstract, supervisor, documentUrl, semester } = req.body;
        const newThesis = new Thesis({
            student: req.user.id,
            supervisor,
            semester,
            title,
            titleEn,
            abstract,
            documentUrl,
        });
        await newThesis.save();
        res.status(201).json(newThesis);
    } catch (error) {
        console.error("Create Thesis Error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

const getTheses = async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'student') {
            query.student = req.user.id;
        } else if (req.user.role === 'professor') {
            query.supervisor = req.user.id;
        }
        if (req.query.semester) {
            query.semester = req.query.semester;
        }
        const theses = await Thesis.find(query).populate('student supervisor', 'name email');
        res.status(200).json(theses);
    } catch (error) {
        console.error("Get Theses Error:", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

const updateThesis = async (req, res) => {
    try {
        const thesis = await Thesis.findById(req.params.id);
        if (!thesis) return res.status(404).json({ message: "Thesis not found" });

        if (thesis.student.toString() !== req.user.id &&
            thesis.supervisor.toString() !== req.user.id &&
            req.user.role !== 'admin') {
            return res.status(403).json({ message: "Not authorized" });
        }

        const updatedThesis = await Thesis.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json(updatedThesis);
    } catch (error) {
        console.error("Update Thesis Error:", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

const deleteThesis = async (req, res) => {
    try {
        const thesis = await Thesis.findById(req.params.id);
        if (!thesis) return res.status(404).json({ message: "Thesis not found" });

        if (thesis.student.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Not authorized" });
        }

        await Thesis.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Thesis deleted successfully" });
    } catch (error) {
        console.error("Delete Thesis Error:", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

const getAllThesesAdmin = async (req, res) => {
    try {
        let query = {};
        if (req.query.semester) {
            query.semester = req.query.semester;
        }
        const theses = await Thesis.find(query).populate('student supervisor', 'name email');
        res.status(200).json(theses);
    } catch (error) {
        console.error("Admin Get Theses Error:", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

const updateThesisAdmin = async (req, res) => {
    try {
        const updatedThesis = await Thesis.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('student supervisor', 'name email');
        if (!updatedThesis) return res.status(404).json({ message: "Thesis not found" });
        res.status(200).json(updatedThesis);
    } catch (error) {
        console.error("Admin Update Thesis Error:", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

const Schedule = require("../models/Schedule");

const deleteAllTheses = async (req, res) => {
    try {
        const semester = req.query.semester;
        if (!semester) {
            return res.status(400).json({ message: "semester query parameter is required to prevent accidental data loss" });
        }
        const theses = await Thesis.find({ semester }).select('_id');
        const thesisIds = theses.map(t => t._id);
        await Schedule.deleteMany({ thesis: { $in: thesisIds } });
        const result = await Thesis.deleteMany({ semester });
        res.status(200).json({ message: `Successfully deleted all schedules and ${result.deletedCount} theses for this semester` });
    } catch (error) {
        console.error("Admin Delete All Theses Error:", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

module.exports = { createThesis, getTheses, updateThesis, deleteThesis, getAllThesesAdmin, updateThesisAdmin, deleteAllTheses };
