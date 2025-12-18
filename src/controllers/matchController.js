const Match = require("../models/Match");
const Team = require("../models/Team");

// ================= CREATE MATCH (TEAM OWNER) =================
exports.cancelMatch = async (req, res) => {
  try {
    const { matchId } = req.body;

    if (!matchId) {
      return res.status(400).json({ message: "Match ID is required" });
    }

    const match = await Match.findById(matchId);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    // Only creator can cancel
    if (match.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only match creator can cancel this match" });
    }

    if (match.status === "COMPLETED") {
      return res.status(400).json({ message: "Completed matches cannot be cancelled" });
    }

    match.status = "CANCELLED";
    await match.save();

    res.json({
      message: "Match cancelled successfully",
      match,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= CREATE MATCH (TEAM OWNER) =================
exports.createMatch = async (req, res) => {
  try {
    if (req.user.role !== "team") {
      return res.status(403).json({ message: "Only team owners can create matches" });
    }

    const {
      opponentTeamId,
      scheduledAt,
      venue,
      format,
      matchType,
      homeOrAway,
    } = req.body;

    if (!opponentTeamId || !scheduledAt || !homeOrAway) {
      return res.status(400).json({
        message: "Opponent team, date, and home/away selection are required",
      });
    }

    if (!["HOME", "AWAY"].includes(homeOrAway)) {
      return res.status(400).json({ message: "homeOrAway must be HOME or AWAY" });
    }

    const myTeam = await Team.findOne({ createdBy: req.user.id });
    if (!myTeam) {
      return res.status(404).json({ message: "Your team not found" });
    }

    const opponentTeam = await Team.findById(opponentTeamId);
    if (!opponentTeam) {
      return res.status(404).json({ message: "Opponent team not found" });
    }

    if (myTeam._id.equals(opponentTeam._id)) {
      return res.status(400).json({ message: "You cannot challenge your own team" });
    }

    const homeTeam =
      homeOrAway === "HOME" ? myTeam._id : opponentTeam._id;

    const awayTeam =
      homeOrAway === "HOME" ? opponentTeam._id : myTeam._id;

    const match = await Match.create({
      createdBy: req.user.id,
      createdByRole: "team",
      homeTeam,
      awayTeam,
      scheduledAt,
      venue,
      format,
      matchType,
      status: "PENDING",
    });

    res.status(201).json({
      message: "Match request sent successfully",
      match,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ================= RESPOND TO MATCH (ACCEPT / REJECT) =================
exports.respondToMatch = async (req, res) => {
  try {
    const { matchId, action, reason } = req.body;

    if (!matchId || !action) {
      return res.status(400).json({ message: "Match ID and action are required" });
    }

    const match = await Match.findById(matchId)
      .populate("homeTeam")
      .populate("awayTeam");

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (match.status !== "PENDING") {
      return res.status(400).json({ message: "Match is no longer pending" });
    }

    // Check if logged-in user owns the away team
    const awayTeam = await Team.findOne({
      _id: match.awayTeam._id,
      createdBy: req.user.id,
    });

    if (!awayTeam) {
      return res.status(403).json({ message: "You are not authorized to respond to this match" });
    }

    if (action === "ACCEPT") {
      match.status = "ACCEPTED";
      match.approval.approvedBy = req.user.id;
      match.approval.approvedAt = new Date();
    }

    if (action === "REJECT") {
      match.status = "REJECTED";
      match.approval.rejectionReason = reason || "Rejected by opponent";
    }

    await match.save();

    res.json({
      message: `Match ${action.toLowerCase()}ed successfully`,
      match,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET MY MATCHES (TEAM DASHBOARD) =================
exports.getMyMatches = async (req, res) => {
  try {
    if (req.user.role !== "team") {
      return res.status(403).json({ message: "Only team owners can view matches" });
    }

    const myTeam = await Team.findOne({ createdBy: req.user.id });
    if (!myTeam) {
      return res.status(404).json({ message: "Your team not found" });
    }

    const matches = await Match.find({
      $or: [
        { homeTeam: myTeam._id },
        { awayTeam: myTeam._id },
      ],
    })
      .populate("homeTeam", "teamName teamLogoUrl")
      .populate("awayTeam", "teamName teamLogoUrl")
      .sort({ scheduledAt: 1 });

    res.json(matches);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET MATCH BY ID =================
exports.getMatchById = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate("homeTeam", "teamName teamLogoUrl location")
      .populate("awayTeam", "teamName teamLogoUrl location")
      .populate("createdBy", "name role");

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    res.json(match);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

