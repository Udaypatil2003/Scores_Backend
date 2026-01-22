// controllers/teamLineupController.js
const Team = require("../models/Team");

exports.saveLineup = async (req, res) => {
  try {
    const { formation, starting, bench } = req.body;

    if (!formation || !Array.isArray(starting)) {
      return res.status(400).json({ message: "Invalid lineup payload" });
    }

    const team = await Team.findOne({ createdBy: req.user.id });
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const teamPlayerIds = team.players.map(id => id.toString());

    // 🔒 Validate starting players
    const startingPlayerIds = starting
  .filter(s => s.player)
  .map(s => s.player.toString());

    for (const pid of startingPlayerIds) {
      if (!teamPlayerIds.includes(pid)) {
        return res.status(400).json({
          message: "Starting player does not belong to your team",
        });
      }
    }

    // 🔒 Validate bench players
    if (bench) {
      for (const pid of bench) {
        if (!teamPlayerIds.includes(pid.toString())) {
          return res.status(400).json({
            message: "Bench player does not belong to your team",
          });
        }
      }
    }

    // 🔒 Prevent duplicates
    const allIds = [...startingPlayerIds, ...(bench || []).map(b => b.toString())];
    const uniqueIds = new Set(allIds);
    if (uniqueIds.size !== allIds.length) {
      return res.status(400).json({
        message: "Duplicate players in lineup",
      });
    }

    team.savedLineup = {
      formation,
      starting,
      bench: bench || [],
    };

    await team.save();

    res.json({
      message: "Lineup saved successfully",
      savedLineup: team.savedLineup,
    });
    

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getLineup = async (req, res) => {
  const team = await Team.findOne({ createdBy: req.user.id })
    .populate("savedLineup.starting.player", "name profileImageUrl position jerseyNumber")
    .populate("savedLineup.bench", "name profileImageUrl position jerseyNumber");

  if (!team) {
    return res.status(404).json({ message: "Team not found" });
  }



  // ✅ IMPORTANT: return 200 even if lineup is not saved yet
  return res.json(team.savedLineup || null);
};

