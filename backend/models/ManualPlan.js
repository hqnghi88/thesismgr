const mongoose = require("mongoose");

const committeeSchema = new mongoose.Schema(
    {
        room: {
            type: String,
            default: "",
        },
        principal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        examinator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        supervisor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        thesisIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Thesis",
            },
        ],
    },
    { _id: true }
);

const sessionSchema = new mongoose.Schema(
    {
        session: {
            type: String,
            enum: ["Sang", "Chieu"],
            required: true,
        },
        committees: [committeeSchema],
    },
    { _id: true }
);

const daySchema = new mongoose.Schema(
    {
        date: {
            type: Date,
            required: true,
        },
        sessions: [sessionSchema],
    },
    { _id: true }
);

const manualPlanSchema = new mongoose.Schema(
    {
        semester: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Semester",
            required: true,
            unique: true,
        },
        days: [daySchema],
    },
    { timestamps: true }
);

module.exports = mongoose.model("ManualPlan", manualPlanSchema);
