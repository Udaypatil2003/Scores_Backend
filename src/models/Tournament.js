const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    organiser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organiser",
      required: true,
    },

    format: {
      type: String,
      enum: ["KNOCKOUT", "LEAGUE"],
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    venue: {
      type: String,
      default: "",
    },

    entryFee: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "DRAFT",
        "REGISTRATION_OPEN",
        "REGISTRATION_CLOSED",
        "FIXTURES_GENERATED",
        "LIVE",
        "COMPLETED",
      ],
      default: "DRAFT",
    },

    teams: [
      {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Team",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        isPaid: {
          type: Boolean,
          default: false,
        },
      },
    ],

    maxTeams: {
      type: Number,
      default: null,
    },
    winner: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Team",
  default: null,
},
  },
  { timestamps: true }
);

/* =================== INDEXES =================== */

// Search open tournaments fast
tournamentSchema.index({ status: 1, startDate: 1 });

// Text search by name
tournamentSchema.index({ name: "text" });

// Location filter
tournamentSchema.index({ venue: 1 });

// Exclude already joined teams
tournamentSchema.index({ "teams.team": 1 });

// Organiser dashboard queries
tournamentSchema.index({ organiser: 1, createdAt: -1 });

module.exports = mongoose.model("Tournament", tournamentSchema);
