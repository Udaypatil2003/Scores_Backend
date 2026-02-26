const Match = require("../models/Match");
const Team = require("../models/Team");
const mongoose = require("mongoose");
const Player = require("../models/Player");
const { endMatchAndUpdateStats } = require("../services/matchService");
const {paginate, paginateResponse} = require("../utils/paginate");

const isPlayerInStartingXI = (lineup, playerId) =>
  lineup.starting.some((s) => s.player && s.player.toString() === playerId);

const isPlayerInBench = (lineup, playerId) =>
  lineup.bench.some((p) => p.toString() === playerId);

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
      return res
        .status(403)
        .json({ message: "Only match creator can cancel this match" });
    }

    const nonCancellableStatuses = ["COMPLETED", "LIVE", "CANCELLED"];
    if (nonCancellableStatuses.includes(match.status)) {
      return res.status(400).json({
        message: `Cannot cancel a match with status: ${match.status}`,
      });
    }

    match.status = "CANCELLED";
    await match.save();

    res.json({ message: "Match cancelled successfully", match });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= CREATE MATCH (TEAM OWNER) =================
exports.createMatch = async (req, res) => {
  try {
    if (req.user.role !== "team") {
      return res
        .status(403)
        .json({ message: "Only team owners can create matches" });
    }

    const {
      opponentTeamId,
      scheduledAt,
      venue,
      format,
      matchType,
      homeOrAway,
      notes, // ── NEW
    } = req.body;

    if (!opponentTeamId || !scheduledAt || !homeOrAway) {
      return res.status(400).json({
        message: "Opponent team, date, and home/away selection are required",
      });
    }

    if (!["HOME", "AWAY"].includes(homeOrAway)) {
      return res
        .status(400)
        .json({ message: "homeOrAway must be HOME or AWAY" });
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
      return res
        .status(400)
        .json({ message: "You cannot challenge your own team" });
    }

    const homeTeam = homeOrAway === "HOME" ? myTeam._id : opponentTeam._id;
    const awayTeam = homeOrAway === "HOME" ? opponentTeam._id : myTeam._id;

    if (!myTeam.savedLineup) {
      return res.status(400).json({
        message: "Please save lineup before creating match",
      });
    }

    const lineups = {};
    lineups[homeOrAway === "HOME" ? "home" : "away"] = {
      formation: myTeam.savedLineup.formation,
      starting: Array.isArray(myTeam.savedLineup.starting)
        ? myTeam.savedLineup.starting
        : [],
      bench: Array.isArray(myTeam.savedLineup.bench)
        ? myTeam.savedLineup.bench
        : [],
      submittedAt: new Date(),
    };

    const match = await Match.create({
      createdBy: req.user.id,
      createdByRole: "team",
      homeTeam,
      awayTeam,
      scheduledAt,
      venue,
      format,
      matchType,
      notes: notes || "", // ── NEW
      status: "PENDING",
      lineups,
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
  const { matchId, action, reason } = req.body;

  const match = await Match.findById(matchId)
    .populate("homeTeam")
    .populate("awayTeam");

  if (!match) {
    return res.status(404).json({ message: "Match not found" });
  }

  if (!match.lineups) {
    match.lineups = {};
  }

  if (match.status !== "PENDING") {
    return res.status(400).json({
      message: "Match is not pending",
    });
  }

  // 🔐 CREATOR CHECK
  if (match.createdBy.toString() === req.user.id) {
    return res.status(403).json({
      message: "Creator cannot respond to their own match",
    });
  }

  // 🔐 TEAM OWNERSHIP CHECK
  const myTeam = await Team.findOne({
    admins: req.user.id,
  });

  if (!myTeam) {
    return res.status(403).json({
      message: "You are not part of any team",
    });
  }

  const isOpponentTeam =
    myTeam._id.toString() === match.homeTeam._id.toString() ||
    myTeam._id.toString() === match.awayTeam._id.toString();

  if (!isOpponentTeam) {
    return res.status(403).json({
      message: "You are not authorized to respond to this match",
    });
  }

  // ✅ ACTION
  if (action === "ACCEPT") {
    if (!myTeam.savedLineup) {
      return res.status(400).json({
        message: "Please save lineup before accepting match",
      });
    }

    const hasStartingPlayers =
      Array.isArray(myTeam.savedLineup.starting) &&
      myTeam.savedLineup.starting.length > 0;

    if (!hasStartingPlayers) {
      return res.status(400).json({
        message: "Please select at least one starting player",
      });
    }

    let side = null;

    if (match.homeTeam._id.toString() === myTeam._id.toString()) {
      side = "home";
    }

    if (match.awayTeam._id.toString() === myTeam._id.toString()) {
      side = "away";
    }

    if (!side) {
      return res.status(403).json({
        message: "You are not a participant in this match",
      });
    }

    // ✅ Save ONLY opponent lineup
    match.lineups[side] = {
      formation: myTeam.savedLineup.formation,
      starting: myTeam.savedLineup.starting,
      bench: Array.isArray(myTeam.savedLineup.bench)
        ? myTeam.savedLineup.bench
        : [],
      submittedAt: new Date(),
    };

    match.status = "ACCEPTED";
  } else if (action === "REJECT") {
    match.status = "REJECTED";
    match.rejectionReason = reason;
  } else {
    return res.status(400).json({ message: "Invalid action" });
  }

  await match.save();

  res.json({
    message: `Match ${action.toLowerCase()}ed successfully`,
    match,
  });
};

// ================= GET MY MATCHES (TEAM DASHBOARD) =================
exports.getMyMatches = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);

    if (req.user.role === "team") {
      const myTeam = await Team.findOne({ createdBy: req.user.id });
      if (!myTeam) {
        return res.status(404).json({ message: "Your team not found" });
      }

      const filter = {
        $or: [{ homeTeam: myTeam._id }, { awayTeam: myTeam._id }],
      };

      const [matches, total] = await Promise.all([
        Match.find(filter)
          .populate("homeTeam", "teamName teamLogoUrl")
          .populate("awayTeam", "teamName teamLogoUrl")
          .sort({ scheduledAt: -1 })
          .skip(skip)
          .limit(limit),
        Match.countDocuments(filter),
      ]);

      return res.json(paginateResponse(matches, total, page, limit));

    } else if (req.user.role === "player") {
      const player = await Player.findOne({ userId: req.user.id });
      if (!player) {
        return res.status(404).json({ message: "Player profile not found" });
      }

      const filter = {
        $or: [
          { "lineups.home.starting.player": player._id },
          { "lineups.home.bench": player._id },
          { "lineups.away.starting.player": player._id },
          { "lineups.away.bench": player._id },
        ],
      };

      const [matches, total] = await Promise.all([
        Match.find(filter)
          .populate("homeTeam", "teamName teamLogoUrl")
          .populate("awayTeam", "teamName teamLogoUrl")
          .sort({ scheduledAt: -1 })
          .skip(skip)
          .limit(limit),
        Match.countDocuments(filter),
      ]);

      return res.json(paginateResponse(matches, total, page, limit));
    }

    return res.status(403).json({ message: "Access denied" });

  } catch (err) {
    next(err);
  }
};

// ================= GET MATCH BY ID =================
exports.getMatchById = async (req, res) => {
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
      .populate("homeTeam", "teamName teamLogoUrl location")
      .populate("awayTeam", "teamName teamLogoUrl location")
      .populate("createdBy", "_id name role")
      .populate("events.player", "name profileImageUrl jerseyNumber")
      .populate("events.assistPlayer", "name profileImageUrl jerseyNumber")
      .populate("events.substitutedPlayer", "name profileImageUrl jerseyNumber")
      .populate("homeTeam", "teamName teamLogoUrl")
      .populate("awayTeam", "teamName teamLogoUrl");

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const homePermissions = getLineupPermissions(match, "home");
    const awayPermissions = getLineupPermissions(match, "away");

    res.json({
      ...match.toObject(),
      permissions: {
        home: homePermissions,
        away: awayPermissions,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= Start Match (IMPROVED) =================
exports.startMatch = async (req, res) => {
  try {
    const { matchId } = req.body;

    if (!matchId) {
      return res.status(400).json({ message: "Match ID is required" });
    }

    const match = await Match.findById(matchId)
      .populate("homeTeam", "teamName")
      .populate("awayTeam", "teamName");

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    // ==================== STATUS VALIDATION ====================
   if (!["ACCEPTED", "LIVE"].includes(match.status)) {
  return res.status(400).json({
    message: `Match cannot be started. Current status: ${match.status}`,
  });
}

    // ==================== PERMISSION LOGIC ====================
    const isTournamentMatch = !!match.tournamentId;
    const isCreator = match.createdBy.toString() === req.user.id;
    const isOrganiser = req.user.role === "organiser";

    let canStart = false;

    if (isTournamentMatch) {
      // Tournament matches: ONLY organiser can start
      canStart = isOrganiser;
    } else {
      // Friendly/Practice: Only creator can start
      canStart = isCreator;
    }

    if (!canStart) {
      return res.status(403).json({
        message: isTournamentMatch
          ? "Only tournament organiser can start this match"
          : "Only match creator can start this match",
      });
    }

    // ==================== LINEUP VALIDATION ====================
    const isValidLineup = (lineup) =>
      lineup &&
      lineup.formation &&
      Array.isArray(lineup.starting) &&
      lineup.starting.length > 0 &&
      lineup.submittedAt; // ✅ MUST be submitted

    const homeLineup = match.lineups?.home;
    const awayLineup = match.lineups?.away;

    if (!isValidLineup(homeLineup)) {
      return res.status(400).json({
        message: `${match.homeTeam.teamName} has not submitted their lineup yet`,
      });
    }

    if (!isValidLineup(awayLineup)) {
      return res.status(400).json({
        message: `${match.awayTeam.teamName} has not submitted their lineup yet`,
      });
    }

    // ==================== START MATCH ====================
    match.status = "LIVE";
    match.startedAt = new Date();

    await match.save();

    return res.json({
      message: "Match started successfully",
      match: {
        _id: match._id,
        status: match.status,
        startedAt: match.startedAt,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      },
    });
  } catch (error) {
    console.error("START MATCH ERROR:", error);
    return res.status(500).json({ message: "Failed to start match" });
  }
};

// =================  match event =================
// exports.addMatchEvent = async (req, res) => {
//   try {
//     const matchId = req.params.id;
//     const { minute, teamId, goal, substitution, card } = req.body;

//     if (minute === undefined || minute === null || !teamId) {
//       return res
//         .status(400)
//         .json({ message: "Minute and teamId are required" });
//     }

//     const match = await Match.findById(matchId);
//     if (!match) return res.status(404).json({ message: "Match not found" });

//     if (match.status !== "LIVE") {
//       return res.status(400).json({ message: "Match is not live" });
//     }

//     if (match.createdBy.toString() !== req.user.id) {
//       return res
//         .status(403)
//         .json({ message: "Only match creator can update events" });
//     }

//     const isHome = match.homeTeam.toString() === teamId;
//     const isAway = match.awayTeam.toString() === teamId;

//     if (!isHome && !isAway) {
//       return res.status(400).json({ message: "Invalid team" });
//     }

//     const lineup = isHome ? match.lineups?.home : match.lineups?.away;

//     if (!lineup) {
//       return res.status(400).json({ message: "Lineup not found for team" });
//     }

//     // ================= LINEUP VALIDATION =================

//     if (goal?.scorer && !isPlayerInStartingXI(lineup, goal.scorer)) {
//       return res.status(400).json({
//         message: "Goal scorer is not in starting lineup",
//       });
//     }

//     if (card?.player && !isPlayerInStartingXI(lineup, card.player)) {
//       return res.status(400).json({
//         message: "Carded player is not in starting lineup",
//       });
//     }

//     if (substitution?.out && substitution?.in) {
//       if (!isPlayerInStartingXI(lineup, substitution.out)) {
//         return res.status(400).json({
//           message: "Substitution out player not in starting XI",
//         });
//       }

//       if (!isPlayerInBench(lineup, substitution.in)) {
//         return res.status(400).json({
//           message: "Substitution in player not on bench",
//         });
//       }
//     }

//     // ================= EVENT CREATION =================

//     const eventsToPush = [];

//     if (goal?.scorer) {
//       if (goal.type === "OWN") {
//         if (isHome) match.score.away += 1;
//         if (isAway) match.score.home += 1;

//         eventsToPush.push({
//           type: "OWN_GOAL",
//           team: teamId,
//           player: goal.scorer,
//           minute,
//         });
//       } else if (goal.type === "PENALTY") {
//         if (isHome) match.score.home += 1;
//         if (isAway) match.score.away += 1;

//         eventsToPush.push({
//           type: "PENALTY_GOAL",
//           team: teamId,
//           player: goal.scorer,
//           minute,
//         });
//       } else {
//         if (isHome) match.score.home += 1;
//         if (isAway) match.score.away += 1;

//         eventsToPush.push({
//           type: "GOAL",
//           team: teamId,
//           player: goal.scorer,
//           assistPlayer: goal.assist || null,
//           minute,
//         });
//       }
//     }

//     if (substitution?.out && substitution?.in) {
//       eventsToPush.push({
//         type: "SUBSTITUTION",
//         team: teamId,
//         player: substitution.out,
//         substitutedPlayer: substitution.in,
//         minute,
//       });
//     }

//     if (card?.type && card?.player) {
//       eventsToPush.push({
//         type: card.type,
//         team: teamId,
//         player: card.player,
//         minute,
//       });
//     }

//     if (eventsToPush.length === 0) {
//       return res.status(400).json({ message: "No valid event data provided" });
//     }

//     match.events.push(...eventsToPush);
//     await match.save();

//     res.json({
//       message: "Match events added successfully",
//       score: match.score,
//       addedEvents: eventsToPush.length,
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

exports.addMatchEvent = async (req, res, next) => {
  try {
    const matchId = req.params.id;
    const { minute, teamId, goal, substitution, card } = req.body;

    if (minute === undefined || minute === null || !teamId) {
      return res
        .status(400)
        .json({ message: "Minute and teamId are required" });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });

    if (match.status !== "LIVE") {
      return res.status(400).json({ message: "Match is not live" });
    }

    // ✅ Permission check based on match type
    const isTournamentMatch = !!match.tournamentId;

    if (isTournamentMatch) {
      // Tournament match — only organiser who owns the tournament can update
      if (req.user.role !== "organiser") {
        return res.status(403).json({
          message: "Only the tournament organiser can update events",
        });
      }

      // Verify organiser owns this tournament
      const Organiser = require("../models/Organiser");
      const Tournament = require("../models/Tournament");

      const organiser = await Organiser.findOne({ user: req.user.id });
      if (!organiser) {
        return res.status(403).json({ message: "Organiser profile not found" });
      }

      const tournament = await Tournament.findById(match.tournamentId)
        .select("organiser")
        .lean();

      if (
        !tournament ||
        tournament.organiser.toString() !== organiser._id.toString()
      ) {
        return res.status(403).json({
          message: "You do not own this tournament",
        });
      }
    } else {
      // Friendly/Practice match — only match creator can update
      if (match.createdBy.toString() !== req.user.id) {
        return res.status(403).json({
          message: "Only match creator can update events",
        });
      }
    }

    // ---- rest of your existing event logic stays exactly the same ----
    const isHome = match.homeTeam.toString() === teamId;
    const isAway = match.awayTeam.toString() === teamId;

    if (!isHome && !isAway) {
      return res.status(400).json({ message: "Invalid team" });
    }

    const lineup = isHome ? match.lineups?.home : match.lineups?.away;
    if (!lineup) {
      return res.status(400).json({ message: "Lineup not found for team" });
    }

    if (goal?.scorer && !isPlayerInStartingXI(lineup, goal.scorer)) {
      return res
        .status(400)
        .json({ message: "Goal scorer is not in starting lineup" });
    }

    if (card?.player && !isPlayerInStartingXI(lineup, card.player)) {
      return res
        .status(400)
        .json({ message: "Carded player is not in starting lineup" });
    }

    if (substitution?.out && substitution?.in) {
      if (!isPlayerInStartingXI(lineup, substitution.out)) {
        return res
          .status(400)
          .json({ message: "Substitution out player not in starting XI" });
      }
      if (!isPlayerInBench(lineup, substitution.in)) {
        return res
          .status(400)
          .json({ message: "Substitution in player not on bench" });
      }
    }

    const eventsToPush = [];

    if (goal?.scorer) {
      if (goal.type === "OWN") {
        if (isHome) match.score.away += 1;
        if (isAway) match.score.home += 1;
        eventsToPush.push({
          type: "OWN_GOAL",
          team: teamId,
          player: goal.scorer,
          minute,
        });
      } else if (goal.type === "PENALTY") {
        if (isHome) match.score.home += 1;
        if (isAway) match.score.away += 1;
        eventsToPush.push({
          type: "PENALTY_GOAL",
          team: teamId,
          player: goal.scorer,
          minute,
        });
      } else {
        if (isHome) match.score.home += 1;
        if (isAway) match.score.away += 1;
        eventsToPush.push({
          type: "GOAL",
          team: teamId,
          player: goal.scorer,
          assistPlayer: goal.assist || null,
          minute,
        });
      }
    }

    if (substitution?.out && substitution?.in) {
      eventsToPush.push({
        type: "SUBSTITUTION",
        team: teamId,
        player: substitution.out,
        substitutedPlayer: substitution.in,
        minute,
      });
    }

    if (card?.type && card?.player) {
      eventsToPush.push({
        type: card.type,
        team: teamId,
        player: card.player,
        minute,
      });
    }

    if (eventsToPush.length === 0) {
      return res.status(400).json({ message: "No valid event data provided" });
    }

    match.events.push(...eventsToPush);
    await match.save();

    res.json({
      message: "Match events added successfully",
      score: match.score,
      addedEvents: eventsToPush.length,
    });
  } catch (err) {
    next(err);
  }
};

// ================= Reset Match =================
exports.resetMatch = async (req, res, next) => {
  try {
    const { id } = req.params;

    const match = await Match.findById(id);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (match.status !== "LIVE") {
      return res
        .status(400)
        .json({ message: "Only LIVE matches can be reset" });
    }

    // ✅ Clean permission check — same pattern as addMatchEvent
    const isTournamentMatch = !!match.tournamentId;

    if (isTournamentMatch) {
      if (req.user.role !== "organiser") {
        return res.status(403).json({
          message: "Only the tournament organiser can reset this match",
        });
      }

      const Organiser = require("../models/Organiser");
      const Tournament = require("../models/Tournament");

      const organiser = await Organiser.findOne({ user: req.user.id });
      if (!organiser) {
        return res.status(403).json({ message: "Organiser profile not found" });
      }

      const tournament = await Tournament.findById(match.tournamentId)
        .select("organiser")
        .lean();

      if (
        !tournament ||
        tournament.organiser.toString() !== organiser._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "You do not own this tournament" });
      }
    } else {
      // Friendly/Practice — only match creator can reset
      if (match.createdBy.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Only match creator can reset this match" });
      }
    }

    // ✅ Clean reset — only fields that exist on schema
    match.score = { home: 0, away: 0 };
    match.events = [];
    match.startedAt = new Date();

    await match.save();

    return res.json({
      message: "Match reset successfully",
      match,
    });
  } catch (err) {
    next(err);
  }
};

// ================= End Match =================

// exports.endMatch = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { matchId } = req.body;

//     const match = await Match.findById(matchId).session(session);
//     if (!match) throw new Error("Match not found");

//     if (match.status !== "LIVE") {
//       throw new Error("Only live matches can be ended");
//     }

//     if (match.createdBy.toString() !== req.user.id) {
//       throw new Error("Only creator can end match");
//     }

//     // -------- PLAYER STATS --------
//     const goalEvents = match.events.filter((e) => e.type === "GOAL");
//     const playerStats = {};

//     goalEvents.forEach((e) => {
//       if (e.player) {
//         playerStats[e.player] = playerStats[e.player] || {
//           goals: 0,
//           assists: 0,
//         };
//         playerStats[e.player].goals += 1;
//       }
//       if (e.assistPlayer) {
//         playerStats[e.assistPlayer] = playerStats[e.assistPlayer] || {
//           goals: 0,
//           assists: 0,
//         };
//         playerStats[e.assistPlayer].assists += 1;
//       }
//     });

//     for (const playerId in playerStats) {
//       await Player.findByIdAndUpdate(
//         playerId,
//         {
//           $inc: {
//             goals: playerStats[playerId].goals,
//             assists: playerStats[playerId].assists,
//             matchesPlayed: 1,
//           },
//         },
//         { session }
//       );
//     }

//     // -------- TEAM STATS --------
//     const homeGoals = match.score.home;
//     const awayGoals = match.score.away;

//     const homeUpdate = {
//       matchesPlayed: 1,
//       goalsScored: homeGoals,
//       goalsConceded: awayGoals,
//     };

//     const awayUpdate = {
//       matchesPlayed: 1,
//       goalsScored: awayGoals,
//       goalsConceded: homeGoals,
//     };

//     if (homeGoals > awayGoals) {
//       homeUpdate.wins = 1;
//       awayUpdate.losses = 1;
//       match.winner = match.homeTeam;
//     } else if (awayGoals > homeGoals) {
//       awayUpdate.wins = 1;
//       homeUpdate.losses = 1;
//       match.winner = match.awayTeam;
//     } else {
//       homeUpdate.draws = 1;
//       awayUpdate.draws = 1;
//     }

//     if (awayGoals === 0) homeUpdate.cleanSheets = 1;
//     if (homeGoals === 0) awayUpdate.cleanSheets = 1;

//     await Team.findByIdAndUpdate(
//       match.homeTeam,
//       { $inc: homeUpdate },
//       { session }
//     );
//     await Team.findByIdAndUpdate(
//       match.awayTeam,
//       { $inc: awayUpdate },
//       { session }
//     );

//     match.status = "COMPLETED";
//     match.completedAt = new Date();

//     await match.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.json({ message: "Match completed successfully" });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     res.status(500).json({ message: err.message });
//   }
// };

exports.endMatch = async (req, res) => {
  try {
    const { matchId } = req.body;

    if (!matchId) {
      return res.status(400).json({ message: "Match ID is required" });
    }

    // Permission check
    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (match.status !== "LIVE") {
      return res.status(400).json({ message: "Match is not live" });
    }
    if (match.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to end match" });
    }

    const result = await endMatchAndUpdateStats(matchId);

    res.json({
      message: "Match ended successfully",
      score: result.match.score,
      winner: result.winner,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

exports.getMatchLineups = async (req, res) => {
  try {
    const { id } = req.params;

    const match = await Match.findById(id)
      .populate("homeTeam", "teamName teamLogoUrl")
      .populate("awayTeam", "teamName teamLogoUrl")
      .populate(
        "lineups.home.starting.player",
        "name profileImageUrl position jerseyNumber",
      )
      .populate(
        "lineups.home.bench",
        "name profileImageUrl position jerseyNumber",
      )
      .populate(
        "lineups.away.starting.player",
        "name profileImageUrl position jerseyNumber",
      )
      .populate(
        "lineups.away.bench",
        "name profileImageUrl position jerseyNumber",
      );

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (!match.lineups?.home || !match.lineups?.away) {
      return res.status(400).json({
        message: "Lineups not submitted by both teams yet",
      });
    }

    res.json({
      home: {
        team: match.homeTeam,
        formation: match.lineups.home.formation,
        starting: match.lineups.home.starting,
        bench: match.lineups.home.bench,
        submittedAt: match.lineups.home.submittedAt,
      },
      away: {
        team: match.awayTeam,
        formation: match.lineups.away.formation,
        starting: match.lineups.away.starting,
        bench: match.lineups.away.bench,
        submittedAt: match.lineups.away.submittedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMatchSummary = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate("homeTeam", "teamName teamLogoUrl")
      .populate("awayTeam", "teamName teamLogoUrl")
      .populate("events.player", "name")
      .populate("events.assistPlayer", "name")
      .populate("events.substitutedPlayer", "name");

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (match.status !== "COMPLETED") {
      return res.status(400).json({ message: "Match not completed yet" });
    }

    const goals = [];
    const cards = [];
    const substitutions = [];

    for (const e of match.events) {
      if (["GOAL", "OWN_GOAL", "PENALTY_GOAL"].includes(e.type)) {
        goals.push({
          minute: e.minute,
          teamId: e.team,
          teamName:
            e.team.toString() === match.homeTeam._id.toString()
              ? match.homeTeam.teamName
              : match.awayTeam.teamName,
          player: e.player?.name || null,
          assist: e.assistPlayer?.name || null,
          type: e.type,
        });
      }

      if (["YELLOW", "RED"].includes(e.type)) {
        cards.push({
          minute: e.minute,
          teamName:
            e.team.toString() === match.homeTeam._id.toString()
              ? match.homeTeam.teamName
              : match.awayTeam.teamName,
          player: e.player?.name,
          type: e.type,
        });
      }

      if (e.type === "SUBSTITUTION") {
        substitutions.push({
          minute: e.minute,
          teamName:
            e.team.toString() === match.homeTeam._id.toString()
              ? match.homeTeam.teamName
              : match.awayTeam.teamName,
          out: e.player?.name,
          in: e.substitutedPlayer?.name,
        });
      }
    }

    res.json({
      match: {
        id: match._id,
        status: match.status,
        venue: match.venue,
        startedAt: match.startedAt,
        completedAt: match.completedAt,
      },

      teams: {
        home: {
          id: match.homeTeam._id,
          name: match.homeTeam.teamName,
          logo: match.homeTeam.teamLogoUrl,
          score: match.score.home,
        },
        away: {
          id: match.awayTeam._id,
          name: match.awayTeam.teamName,
          logo: match.awayTeam.teamLogoUrl,
          score: match.score.away,
        },
      },

      winner: match.winner
        ? {
            teamId: match.winner,
            teamName:
              match.winner.toString() === match.homeTeam._id.toString()
                ? match.homeTeam.teamName
                : match.awayTeam.teamName,
          }
        : null,

      summary: {
        goals,
        cards,
        substitutions,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= GET MATCHES BY TOURNAMENT (TEAM VIEW) =================
exports.getMatchesByTournament = async (req, res) => {
  try {
    if (req.user.role !== "team") {
      return res.status(403).json({ message: "Access denied" });
    }

    const team = await Team.findOne({ createdBy: req.user.id });
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const matches = await Match.find({
      tournamentId: req.params.id,
      $or: [{ homeTeam: team._id }, { awayTeam: team._id }],
    })
      .populate("homeTeam", "teamName teamLogoUrl")
      .populate("awayTeam", "teamName teamLogoUrl")
      .sort({ scheduledAt: 1 })
      .lean(); // IMPORTANT

    const data = matches.map((match) => {
      const isHome = match.homeTeam._id.toString() === team._id.toString();
      const isAway = match.awayTeam._id.toString() === team._id.toString();

      const side = isHome ? "home" : isAway ? "away" : null;

      const lineupSubmitted = side && match.lineups?.[side]?.submittedAt;

      const canEditLineup =
        !!side && !["LIVE", "COMPLETED"].includes(match.status);

      return {
        ...match,
        permissions: {
          isMyMatch: !!side,
          canEditLineup,
          side, // useful for frontend
        },
      };
    });

    res.json(data);
  } catch (err) {
    console.error("getMatchesByTournament error", err);
    res.status(500).json({ message: err.message });
  }
};
