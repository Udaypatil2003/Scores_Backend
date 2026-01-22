const mongoose = require("mongoose");

const organiserSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    logoUrl: {
      type: String,
      default: "",
    },

    contactEmail: {
      type: String,
      default: "",
    },

    contactPhone: {
      type: String,
      default: "",
    },

    location: {
      type: String,
      default: "",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organiser", organiserSchema);
