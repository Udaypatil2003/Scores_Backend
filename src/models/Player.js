const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    name: { type: String, required: true },
    email: { type: String },
    mobile: { type: String },

    age: { type: Number },
    position: { type: String, enum: ["GK", "DEF", "MID", "FW"], required: true },
    jerseyNumber: { type: Number, required: true },
    footed: { type: String, enum: ["Left", "Right", "Both"], default: "Right" },

    profileImageUrl: { type: String },

    height: { type: Number },
    weight: { type: Number },

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },

    isFreeAgent: { type: Boolean, default: true },

    // game stats
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    yellowCards: { type: Number, default: 0 },
    redCards: { type: Number, default: 0 },
    matchesPlayed: { type: Number, default: 0 },
    cleanSheets: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Player", playerSchema);
