const mongoose = require("mongoose");

const matchEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "GOAL",
        "OWN_GOAL",
        "PENALTY_GOAL",
        "YELLOW",
        "RED",
        "SUBSTITUTION",
      ],
      required: true,
    },

    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    // Player involved (goal scorer, card receiver, player out)
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },

    // Assist (only for GOAL / PENALTY_GOAL)
    assistPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },

    // Substitution specific
    substitutedPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },

    minute: {
      type: Number,
      required: true,
      min: 0,
      max: 130, // extra time support
    },
  },
  { timestamps: true }
);


const matchSchema = new mongoose.Schema(
  {
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

    venue: { type: String, default: "" },

    scheduledAt: { type: Date, required: true },
     notes: {
      type: String,
      default: "",
      maxlength: 1000,
    },

  status: {
  type: String,
  enum: ["PENDING", "ACCEPTED", "LIVE", "PAUSED", "COMPLETED", "CANCELLED",    "REJECTED", ],
  default: "PENDING",
},

    approval: {
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      approvedAt: { type: Date, default: null },
      rejectionReason: { type: String, default: "" },
    },

    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    score: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 },
    },

    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },

    events: [matchEventSchema],
    lineups: {
  home: {
    formation: { type: String },
    starting: [
      {
        slotKey: String,
        player: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Player",
        },
      },
    ],
    bench: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
      },
    ],
    submittedAt: { type: Date },
  },

  away: {
    formation: { type: String },
    starting: [
      {
        slotKey: String,
        player: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Player",
        },
      },
    ],
    bench: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
      },
    ],
    submittedAt: { type: Date },
  },
},
tournamentId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Tournament",
  default: null,
  index: true,
},

round: {
  type: Number,
  default: null,
},
tournamentContext: {
  isTournamentMatch: { type: Boolean, default: false },
  tournamentRound: { type: Number },
},


  },
  
  { timestamps: true }
);

module.exports = mongoose.model("Match", matchSchema);
