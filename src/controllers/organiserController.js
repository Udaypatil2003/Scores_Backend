const Organiser = require("../models/Organiser");
const { uploadImage } = require("../utils/uploadImage");
const Tournament = require("../models/Tournament");
const Match = require("../models/Match");

exports.saveOrganiserProfile = async (req, res) => {
  try {
    console.log("📥 SAVE PROFILE REQUEST");
    console.log("User:", req.user.id);
    console.log("Body:", req.body);
    console.log("Files:", req.files);

    if (req.user.role !== "organiser") {
      return res.status(403).json({
        message: "Only organisers can access this resource",
      });
    }

    const {
      name,
      description = "",
      contactEmail = "",
      contactPhone = "",
      location = "",
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Organiser name is required",
      });
    }

    // ✅ HANDLE LOGO UPLOAD (only once!)
    let logoUrl = null;
    if (req.files?.logo?.[0]) {
      console.log("📸 Uploading logo...");
      try {
        logoUrl = await uploadImage(req.files.logo[0].buffer, "organisers");
        console.log("✅ Logo uploaded successfully:", logoUrl);
      } catch (uploadErr) {
        console.error("❌ Logo upload failed:", uploadErr);
        return res.status(500).json({
          message: "Failed to upload logo",
          error: uploadErr.message,
        });
      }
    }

    let organiser = await Organiser.findOne({ user: req.user.id });

    // CREATE NEW PROFILE
    if (!organiser) {
      console.log("Creating new organiser profile...");

      organiser = await Organiser.create({
        user: req.user.id,
        name: name.trim(),
        description,
        contactEmail,
        contactPhone,
        location,
        logoUrl: logoUrl || "", // ✅ Use uploaded URL or empty string
      });

      console.log("✅ Profile created:", organiser._id);

      return res.status(201).json({
        success: true,
        message: "Organiser profile created successfully",
        organiser,
      });
    }

    // UPDATE EXISTING PROFILE
    console.log("Updating existing organiser profile...");

    organiser.name = name.trim();
    organiser.description = description;
    organiser.contactEmail = contactEmail;
    organiser.contactPhone = contactPhone;
    organiser.location = location;

    // ✅ Only update logo if new one was uploaded
    if (logoUrl) {
      organiser.logoUrl = logoUrl;
    }

    await organiser.save();

    console.log("✅ Profile updated successfully");

    res.json({
      success: true,
      message: "Organiser profile updated successfully",
      organiser,
    });
  } catch (err) {
    console.error("❌ SAVE ORGANISER PROFILE ERROR:", err);
    res.status(500).json({
      message: err.message,
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/** * GET MY ORGANISER PROFILE*/
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
    if (req.user.role !== "organiser") {
      return res.status(403).json({
        message: "Only organisers can access tournaments",
      });
    }

    // Step 1: get the Organiser document from User ID
    const organiser = await Organiser.findOne({ user: req.user.id });
    if (!organiser) {
      return res.status(404).json({ message: "Organiser profile not found" });
    }

    // Step 2: query tournaments using Organiser _id
    const tournaments = await Tournament.find({
      organiser: organiser._id, // ← correct
    })
      .sort({ createdAt: -1 })
      .populate("organiser", "name");

    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
