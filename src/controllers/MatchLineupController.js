// controllers/matchLineupController.js
const Match = require("../models/Match");
const Team = require("../models/Team");

/**
 * Helper: identify team side in match
 */
function getTeamSide(match, teamId) {
  if (String(match.homeTeam) === String(teamId)) return "home";
  if (String(match.awayTeam) === String(teamId)) return "away";
  return null;
}

/**
 * POST /api/match/:id/lineup
 * Submit lineup for a match (home or away)
 */
exports.submitLineup = async (req, res) => {
  try {
    const { formation, starting, bench } = req.body;
    const matchId = req.params.id;

    if (!formation || !Array.isArray(starting)) {
      return res.status(400).json({ message: "Invalid lineup payload" });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    // Match state validation
    // if (!["ACCEPTED", "LIVE"].includes(match.status)) {
    //   return res.status(400).json({
    //     message: "Lineup can only be submitted before or during match",
    //   });
    // }

    const isTournamentMatch = !!match.tournamentId;

if (
  !["ACCEPTED", "LIVE"].includes(match.status) &&
  !isTournamentMatch
) {
  return res.status(400).json({
    message: "Lineup can only be submitted before or during match",
  });
}


    // Team validation
    const team = await Team.findOne({ createdBy: req.user.id });
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const side = getTeamSide(match, team._id);
    if (!side) {
      return res.status(403).json({
        message: "You are not part of this match",
      });
    }

    // Lock lineup once match is LIVE
    if (match.status === "LIVE" && match.lineups?.[side]?.submittedAt) {
      return res.status(400).json({
        message: "Lineup is locked after match start",
      });
    }

    // -------------------------
    // PLAYER VALIDATIONS
    // -------------------------
    const teamPlayerIds = team.players.map(p => p.toString());

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

    if (bench) {
      for (const pid of bench) {
        if (!teamPlayerIds.includes(pid.toString())) {
          return res.status(400).json({
            message: "Bench player does not belong to your team",
          });
        }
      }
    }

    // Prevent duplicates
    const allIds = [
      ...startingPlayerIds,
      ...(bench || []).map(b => b.toString()),
    ];
    const uniqueIds = new Set(allIds);
    if (uniqueIds.size !== allIds.length) {
      return res.status(400).json({
        message: "Duplicate players in lineup",
      });
    }

    // -------------------------
    // SAVE LINEUP TO MATCH
    // -------------------------
    match.lineups[side] = {
      formation,
      starting,
      bench: bench || [],
      submittedAt: new Date(),
    };

    await match.save();

    return res.json({
      message: "Lineup submitted successfully",
      side,
      lineup: match.lineups[side],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/match/:id/lineups
 * Get both team lineups for a match
 */
exports.getMatchLineups = async (req, res) => {
function getLineupPermissions(match, side) {
  if (!match) return { canEdit: false };

  if (match.status === "LIVE" || match.status === "COMPLETED") {
    return { canEdit: false, reason: "MATCH_LOCKED" };
  }

  if (match.lineups?.[side]?.submittedAt) {
    return { canEdit: false, reason: "ALREADY_SUBMITTED" };
  }

  return { canEdit: true };
}

  try {
    const match = await Match.findById(req.params.id)
      .populate("lineups.home.starting.player", "name position jerseyNumber profileImageUrl")
      .populate("lineups.home.bench", "name position jerseyNumber profileImageUrl")
      .populate("lineups.away.starting.player", "name position jerseyNumber profileImageUrl")
      .populate("lineups.away.bench", "name position jerseyNumber profileImageUrl");

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const homePermissions = getLineupPermissions(match, "home");
    const awayPermissions = getLineupPermissions(match, "away");

    res.json({
      home: match.lineups?.home || null,
      away: match.lineups?.away || null,
      permissions: {
        home: homePermissions,
        away: awayPermissions,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
