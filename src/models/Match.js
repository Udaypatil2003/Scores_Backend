const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
  {
    // Who created the match
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdByRole: {
      type: String,
      enum: ["team", "organiser"],
      required: true,
    },

    // Teams involved
    homeTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    // Match details
    matchType: {
      type: String,
      enum: ["Friendly", "Tournament", "Practice"],
      default: "Friendly",
    },

    format: {
      type: String,
      enum: ["5v5", "7v7", "9v9", "11v11"],
      default: "7v7",
    },

    venue: {
      type: String,
      default: "",
    },

    scheduledAt: {
      type: Date,
      required: true,
    },

    // Negotiation / lifecycle
    status: {
      type: String,
      enum: [
        "DRAFT",     // organiser only (future)
        "PENDING",   // waiting for opponent approval
        "ACCEPTED",
        "REJECTED",
        "CANCELLED",
        "COMPLETED",
      ],
      default: "PENDING",
    },

    // Approval metadata
    approval: {
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      approvedAt: {
        type: Date,
        default: null,
      },
      rejectionReason: {
        type: String,
        default: "",
      },
    },

    // Result (later phase)
    score: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 },
    },

    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Match", matchSchema);
