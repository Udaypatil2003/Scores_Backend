const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    // Basic Identity
    teamName: { type: String, required: true, trim: true, unique: true , index:true },
    description: { type: String, default: "" },
    location: { type: String, default: "" },
    foundedYear: { type: Number },

    // Branding and Media
    teamLogoUrl: { type: String, default: "" },
    coverImageUrl: { type: String, default: "" },
    galleryImages: [{ type: String }], // array of image URLs

    teamType: {
      type: String,
      enum: ["Amateur", "Professional", "Academy"],
      default: "Amateur",
    },

    // Ownership & Permissions
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Player Squad
    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
      },
    ],

    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },

    viceCaptain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },

    // Team Statistics (expandable)
    matchesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    goalsScored: { type: Number, default: 0 },
    goalsConceded: { type: Number, default: 0 },
    cleanSheets: { type: Number, default: 0 },

    // Social Features
    followersCount: { type: Number, default: 0 },

    // Team State
    isVerifiedTeam: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Team", teamSchema);
