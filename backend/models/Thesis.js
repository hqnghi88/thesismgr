const mongoose = require("mongoose");

const thesisSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        supervisor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        abstract: {
            type: String,
        },
        status: {
            type: String,
            enum: ["submitted", "under_review", "approved", "scheduled", "completed"],
            default: "submitted",
        },
        documentUrl: {
            type: String,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Thesis", thesisSchema);
