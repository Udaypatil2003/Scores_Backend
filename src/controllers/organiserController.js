const Organiser = require("../models/Organiser");
const { uploadImage } = require("../utils/uploadImage");
const Tournament = require("../models/Tournament");
const Match = require("../models/Match");

/**
 * CREATE OR UPDATE ORGANISER PROFILE
 * Called AFTER signup & login
 * Role must be "organiser"
 */
exports.saveOrganiserProfile = async (req, res) => {
  try {
    // 🔒 Role guard
    if (req.user.role !== "organiser") {
      return res
        .status(403)
        .json({ message: "Only organisers can access this resource" });
    }

    const {
      name,
      description,
      contactEmail,
      contactPhone,
      location,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Organiser name is required",
      });
    }

    let logoUrl = "";

    if (req.files?.logo?.[0]) {
      logoUrl = await uploadImage(
        req.files.logo[0].buffer,
        "organisers"
      );
    }

    let organiser = await Organiser.findOne({ user: req.user.id });

    // ---------------- CREATE ----------------
    if (!organiser) {
      organiser = await Organiser.create({
        user: req.user.id,
        name,
        description,
        contactEmail,
        contactPhone,
        location,
        logoUrl,
      });

      return res.status(201).json({
        message: "Organiser profile created successfully",
        organiser,
      });
    }

    // ---------------- UPDATE ----------------
    organiser.name = name;
    organiser.description = description || organiser.description;
    organiser.contactEmail = contactEmail || organiser.contactEmail;
    organiser.contactPhone = contactPhone || organiser.contactPhone;
    organiser.location = location || organiser.location;

    if (logoUrl) organiser.logoUrl = logoUrl;

    await organiser.save();

    res.json({
      message: "Organiser profile updated successfully",
      organiser,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET MY ORGANISER PROFILE
 */
exports.getMyOrganiserProfile = async (req, res) => {
  try {
    if (req.user.role !== "organiser") {
      return res
        .status(403)
        .json({ message: "Only organisers can access this resource" });
    }

    const organiser = await Organiser.findOne({ user: req.user.id });

    if (!organiser) {
      return res.status(404).json({
        message: "Organiser profile not found",
      });
    }

    res.json(organiser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * CHECK IF ORGANISER PROFILE IS COMPLETE
 * Useful for frontend guards
 */
exports.checkOrganiserProfile = async (req, res) => {
  try {
    if (req.user.role !== "organiser") {
      return res.status(403).json({ complete: false });
    }

    const organiser = await Organiser.findOne({ user: req.user.id });

    res.json({
      complete: !!organiser,
    });
  } catch (err) {
    res.status(500).json({ complete: false });
  }
};

// GET MY TOURNAMENTS (ORGANISER)
exports.getMyTournaments = async (req, res) => {
  try {
    // 🔒 Role guard
    if (req.user.role !== "organiser") {
      return res.status(403).json({
        message: "Only organisers can access tournaments",
      });
    }

    const tournaments = await Tournament.find({
      organiser: req.user.id,
    })
      .sort({ createdAt: -1 })
      .populate("organiser", "name");

    res.json(tournaments);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.getMyMatches = async (req, res) => {
  try {
    if (req.user.role !== "organiser") {
      return res.status(403).json({ message: "Access denied" });
    }

    const matches = await Match.find({
      createdBy: req.user.id,
      createdByRole: "organiser",
    })
      .sort({ createdAt: -1 })
      .populate("homeTeam awayTeam");

    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

