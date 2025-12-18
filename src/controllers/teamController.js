const Team = require("../models/Team");
const Player = require("../models/Player");
const { uploadImage } = require("../utils/uploadImage");

// ---------------- Create TEAM ----------------
exports.createTeam = async (req, res) => {
  try {
    const { teamName, description, location, foundedYear } = req.body;

    let teamLogoUrl = "";
    let coverImageUrl = "";

    // Upload logo if provided
    if (req.files?.teamLogo?.[0]) {
      teamLogoUrl = await uploadImage(
        req.files.teamLogo[0].buffer,
        "teams"
      );
    }

    // Upload cover if provided
    if (req.files?.coverImage?.[0]) {
      coverImageUrl = await uploadImage(
        req.files.coverImage[0].buffer,
        "teams"
      );
    }

    const team = await Team.create({
      teamName,
      description,
      location,
      foundedYear,
      teamLogoUrl,
      coverImageUrl,
      createdBy: req.user.id,
      admins: [req.user.id],
    });

    res.status(201).json({
      message: "Team created successfully",
      team,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// ---------------- GET MY TEAM ----------------
exports.getMyTeam = async (req, res) => {
  try {
    const team = await Team.findOne({ createdBy: req.user.id }).populate("players");
    if (!team) return res.status(404).json({ message: "Team not found" });

    res.json(team);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- UPDATE TEAM ----------------
exports.updateTeam = async (req, res) => {
  try {
    const team = await Team.findOne({ createdBy: req.user.id });
    if (!team) return res.status(404).json({ message: "Team not found" });

    const { teamName, description, location, foundedYear } = req.body;

    if (teamName) team.teamName = teamName;
    if (description) team.description = description;
    if (location) team.location = location;
    if (foundedYear) team.foundedYear = foundedYear;

    if (req.files?.teamLogo) {
      team.teamLogoUrl = await uploadImage(req.files.teamLogo[0].buffer, "teams");
    }

    if (req.files?.coverImage) {
      team.coverImageUrl = await uploadImage(req.files.coverImage[0].buffer, "teams");
    }

    await team.save();
    res.json({ message: "Team updated", team });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- ADD PLAYER ----------------
exports.addPlayer = async (req, res) => {
  try {
    const team = await Team.findOne({ createdBy: req.user.id });
    if (!team) return res.status(404).json({ message: "Team not found" });

    const { playerId } = req.body;
    const player = await Player.findById(playerId);

    if (!player) return res.status(404).json({ message: "Player not found" });
    if (!player.isFreeAgent) return res.status(400).json({ message: "Player already has a team" });

    team.players.push(playerId);
    player.teamId = team._id;
    player.isFreeAgent = false;

    await team.save();
    await player.save();

    res.json({ message: "Player added", team });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- REMOVE PLAYER ----------------
exports.removePlayer = async (req, res) => {
  try {
    const team = await Team.findOne({ createdBy: req.user.id });
    if (!team) return res.status(404).json({ message: "Team not found" });

    const { playerId } = req.body;

    team.players = team.players.filter((id) => id.toString() !== playerId);

    const player = await Player.findById(playerId);
    if (player) {
      player.teamId = null;
      player.isFreeAgent = true;
      await player.save();
    }

    await team.save();
    res.json({ message: "Player removed", team });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- PUBLIC GET TEAM ----------------
exports.getTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).populate("players", "name profileImageUrl position");
    if (!team) return res.status(404).json({ message: "Team not found" });

    res.json(team);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- SEARCH TEAMS ----------------
exports.searchTeams = async (req, res) => {
  try {
    const { q } = req.query;

    const myTeam = await Team.findOne({ createdBy: req.user.id });

    const teams = await Team.find({
      teamName: { $regex: q, $options: "i" },
      _id: { $ne: myTeam?._id },
    }).select("teamName teamLogoUrl location");

    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- GET ALL TEAMS ----------------
exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .select("teamName teamLogoUrl location foundedYear")
      .sort({ createdAt: -1 });

    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


