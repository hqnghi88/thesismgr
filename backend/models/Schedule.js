const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema(
    {
        thesis: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Thesis",
            required: true,
            unique: true,
        },
        principal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        examinator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        supervisor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        startTime: {
            type: Date,
            required: true,
        },
        endTime: {
            type: Date,
            required: true,
        },
        room: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["tentative", "confirmed", "cancelled"],
            default: "tentative",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Schedule", scheduleSchema);
