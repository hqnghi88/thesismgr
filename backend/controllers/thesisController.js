const Thesis = require("../models/Thesis");

const createThesis = async (req, res) => {
    try {
        const { title, abstract, supervisor, documentUrl } = req.body;
        const newThesis = new Thesis({
            student: req.user.id,
            supervisor,
            title,
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

        // Only student (owner) or supervisor or admin can update
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

module.exports = { createThesis, getTheses, updateThesis, deleteThesis };
