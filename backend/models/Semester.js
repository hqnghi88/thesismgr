const mongoose = require("mongoose");

const semesterSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        displayName: {
            type: String,
            required: true,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Semester", semesterSchema);
