const Player = require("../models/Player");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const { paginate, paginateResponse } = require("../utils/paginate");

const User = require("../models/User");

function getPublicId(url) {
  if (!url) return null;

  // Remove query params if any
  url = url.split("?")[0];

  // Example:
  // .../upload/v1765348910/players/txzrfvzdi4gengutnie0.jpg

  const parts = url.split("/");

  // filename: txzrfvzdi4gengutnie0.jpg
  const filename = parts.pop();
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf(".")); 

  // everything after "upload/" is folder structure + filename
  const uploadIndex = parts.indexOf("upload");

  // folders after upload, excluding version number (v123434)
  const folderParts = parts.slice(uploadIndex + 2); 
  // e.g. ["players"]

  const folderPath = folderParts.join("/");

  return `${folderPath}/${nameWithoutExt}`;
}


// ================= GET PLAYER DETAILS =================
exports.getPlayerDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user basic info
    const user = await User.findById(userId).select("name mobile email role");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if Player profile exists
    const player = await Player.findOne({ userId });

    if (!player) {
      // Player profile not created yet → Pre-fill user data only
      return res.json({
        isProfileCompleted: false,
        user,
        player: null
      });
    }

    // If profile exists → return full profile
    return res.json({
      isProfileCompleted: true,
      user,
      player
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= CREATE PLAYER PROFILE =================
exports.createProfile = async (req, res) => {
  try {
    const { position, jerseyNumber, footed, age, height, weight } = req.body;

    // Prevent duplicate player profile
    const exists = await Player.findOne({ userId: req.user.id });
    if (exists) {
      return res.status(400).json({ message: "Player profile already created!" });
    }

    // Upload Image to Cloudinary
    let profileImageUrl = "";

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
          { folder: "players" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      profileImageUrl = uploadResult.secure_url;
    }

    // Create Player Profile
    const player = await Player.create({
      userId: req.user.id,
      name: req.user.name,
      email: req.user.email,
      mobile: req.user.mobile,
      age,
      position,
      jerseyNumber,
      footed,
      height,
      weight,
      profileImageUrl,
      isFreeAgent: true,
    });

    res.status(201).json({
      message: "Player profile created successfully",
      player,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ================= SEARCH PLAYERS =================
exports.searchPlayers = async (req, res, next) => {
  try {
    const { name, position } = req.query;
    const { page, limit, skip } = paginate(req.query);

    const filter = {};
    if (name) filter.name = new RegExp(name.trim(), "i");
    if (position) filter.position = position;

    const [players, total] = await Promise.all([
      Player.find(filter)
        .select("name profileImageUrl position jerseyNumber age footed isFreeAgent teamId")
        .skip(skip)
        .limit(limit),
      Player.countDocuments(filter),
    ]);

    res.json(paginateResponse(players, total, page, limit));

  } catch (err) {
    next(err);
  }
};


// ================= UPDATE PLAYER PROFILE =================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    let player = await Player.findOne({ userId });
    if (!player) {
      return res.status(404).json({ message: "Player profile not found" });
    }

    const { position, jerseyNumber, footed, age, height, weight } = req.body;

    // If new image uploaded
    if (req.file) {
      if (player.profileImageUrl) {
        const publicId = getPublicId(player.profileImageUrl);
        if (publicId) await cloudinary.uploader.destroy(publicId);
      }

      const uploadResult = await new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
          { folder: "players" },
          (error, result) => error ? reject(error) : resolve(result)
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      player.profileImageUrl = uploadResult.secure_url;
    }

    // Update only provided fields
    const fields = { position, jerseyNumber, footed, age, height, weight };

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        player[key] = value;
      }
    });

    await player.save();

    res.json({ message: "Player profile updated successfully", player });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


