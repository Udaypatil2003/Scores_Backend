const Match = require("../models/Match");
const Team = require("../models/Team");
const mongoose = require("mongoose");
const Player = require("../models/Player");

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

    if (match.status === "COMPLETED") {
      return res
        .status(400)
        .json({ message: "Completed matches cannot be cancelled" });
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
      status: "PENDING",
      lineups, // ✅ always exists now
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
exports.getMyMatches = async (req, res) => {
  try {
    if (req.user.role !== "team") {
      return res
        .status(403)
        .json({ message: "Only team owners can view matches" });
    }

    const myTeam = await Team.findOne({ createdBy: req.user.id });
    if (!myTeam) {
      return res.status(404).json({ message: "Your team not found" });
    }

    const matches = await Match.find({
      $or: [{ homeTeam: myTeam._id }, { awayTeam: myTeam._id }],
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

// ================= Start Match =================
exports.startMatch = async (req, res) => {
  const { matchId } = req.body;

  const match = await Match.findById(matchId);

  if (!match) {
    return res.status(404).json({ message: "Match not found" });
  }

  if (match.status !== "ACCEPTED") {
    return res.status(400).json({ message: "Match cannot be started" });
  }

  if (match.createdBy.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ message: "Only creator can start the match" });
  }

  const isValidLineup = (l) =>
    l && l.formation && Array.isArray(l.starting) && l.starting.length > 0;

  const homeLineup = match.lineups?.home;
  const awayLineup = match.lineups?.away;

  if (!isValidLineup(homeLineup) || !isValidLineup(awayLineup)) {
    return res.status(400).json({
      message: "Both teams must submit at least one starting player",
    });
  }

  match.status = "LIVE";
  match.startedAt = new Date();

  await match.save();

  res.json({ message: "Match started", match });
};

// =================  match event =================
exports.addMatchEvent = async (req, res) => {
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

    if (match.createdBy.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Only match creator can update events" });
    }

    const isHome = match.homeTeam.toString() === teamId;
    const isAway = match.awayTeam.toString() === teamId;

    if (!isHome && !isAway) {
      return res.status(400).json({ message: "Invalid team" });
    }

    // ✅ NOW lineup can be resolved safely
    const lineup = isHome ? match.lineups?.home : match.lineups?.away;

    if (!lineup) {
      return res.status(400).json({ message: "Lineup not found for team" });
    }

    // ================= LINEUP VALIDATION =================

    if (goal?.scorer && !isPlayerInStartingXI(lineup, goal.scorer)) {
      return res.status(400).json({
        message: "Goal scorer is not in starting lineup",
      });
    }

    if (card?.player && !isPlayerInStartingXI(lineup, card.player)) {
      return res.status(400).json({
        message: "Carded player is not in starting lineup",
      });
    }

    if (substitution?.out && substitution?.in) {
      if (!isPlayerInStartingXI(lineup, substitution.out)) {
        return res.status(400).json({
          message: "Substitution out player not in starting XI",
        });
      }

      if (!isPlayerInBench(lineup, substitution.in)) {
        return res.status(400).json({
          message: "Substitution in player not on bench",
        });
      }
    }

    // ================= EVENT CREATION =================

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
    res.status(500).json({ message: err.message });
  }
};

// ================= Reset Match =================
exports.resetMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const match = await Match.findById(id);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (match.status !== "LIVE") {
      return res.status(400).json({
        message: "Only LIVE matches can be reset",
      });
    }

    // Authorization
    const creatorId = match.createdBy.toString();

    if (creatorId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Only match creator can update events" });
    }

    const isCreator = creatorId === userId;
    const isHomeAdmin = match.homeTeamAdmins?.includes(userId);
    const isAwayAdmin = match.awayTeamAdmins?.includes(userId);
    const isOrganiser = req.user.role === "organiser";

    if (!isCreator && !isHomeAdmin && !isAwayAdmin && !isOrganiser) {
      return res.status(403).json({ message: "Not authorized to reset match" });
    }

    // RESET LOGIC
    match.score = { home: 0, away: 0 };
    match.events = [];
    match.startedAt = new Date(); // reset timer reference
    match.lastResetAt = new Date();
    match.resetCount = (match.resetCount || 0) + 1;

    await match.save();

    return res.json({
      message: "Match reset successfully",
      match,
    });
  } catch (err) {
    console.error("RESET MATCH ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { matchId } = req.body;
  

    if (!matchId) {
      return res.status(400).json({ message: "Match ID is required" });
    }

    const match = await Match.findById(matchId).session(session);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    console.log("END MATCH DEBUG", {
  matchId,
  status: match.status,
  homeLineup: !!match.lineups?.home,
  awayLineup: !!match.lineups?.away,
  homeStarting: match.lineups?.home?.starting?.length,
  awayStarting: match.lineups?.away?.starting?.length,
  eventsCount: match.events?.length,
});

    if (match.status !== "LIVE") {
      return res.status(400).json({ message: "Match is not live" });
    }

    // Permission: only creator
    if (match.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to end match" });
    }

    /* ----------------------------------------------------
       TEAM SCORE & RESULT
    ---------------------------------------------------- */
    const homeGoals = match.score.home;
    const awayGoals = match.score.away;

    let winner = null;
    if (homeGoals > awayGoals) winner = match.homeTeam;
    if (awayGoals > homeGoals) winner = match.awayTeam;

    /* ----------------------------------------------------
       LOAD TEAMS
    ---------------------------------------------------- */
    const homeTeam = await Team.findById(match.homeTeam).session(session);
    const awayTeam = await Team.findById(match.awayTeam).session(session);

    if (!homeTeam || !awayTeam) {
      throw new Error("Teams not found");
    }

    /* ----------------------------------------------------
       TEAM STATS UPDATE
    ---------------------------------------------------- */
    homeTeam.matchesPlayed += 1;
    awayTeam.matchesPlayed += 1;

    homeTeam.goalsScored += homeGoals;
    homeTeam.goalsConceded += awayGoals;

    awayTeam.goalsScored += awayGoals;
    awayTeam.goalsConceded += homeGoals;

    if (homeGoals > awayGoals) {
      homeTeam.wins += 1;
      awayTeam.losses += 1;
    } else if (awayGoals > homeGoals) {
      awayTeam.wins += 1;
      homeTeam.losses += 1;
    } else {
      homeTeam.draws += 1;
      awayTeam.draws += 1;
    }

    if (awayGoals === 0) homeTeam.cleanSheets += 1;
    if (homeGoals === 0) awayTeam.cleanSheets += 1;

    /* ----------------------------------------------------
       PLAYER PARTICIPATION (matchesPlayed)
    ---------------------------------------------------- */
    const playedPlayers = new Set();

    // Starting XI
    match.lineups?.home?.starting?.forEach((p) => {
      if (p?.player) {
        playedPlayers.add(p.player.toString());
      }
    });

    match.lineups?.away?.starting?.forEach((p) => {
      if (p?.player) {
        playedPlayers.add(p.player.toString());
      }
    });

    // Substituted-in players
    match.events
      .filter((e) => e.type === "SUBSTITUTION" && e.substitution?.in)
      .forEach((e) => {
        playedPlayers.add(e.substitution.in.toString());
      });

    /* ----------------------------------------------------
       PLAYER STATS FROM EVENTS
    ---------------------------------------------------- */
    const playerStatsMap = {};

    const ensurePlayer = (id) => {
      if (!playerStatsMap[id]) {
        playerStatsMap[id] = {
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          cleanSheets: 0,
        };
      }
    };

    for (const event of match.events || []) {
      // GOALS
      if (event.goal?.scorer) {
        ensurePlayer(event.goal.scorer.toString());
        playerStatsMap[event.goal.scorer.toString()].goals += 1;
      }

      if (event.goal?.assist) {
        ensurePlayer(event.goal.assist.toString());
        playerStatsMap[event.goal.assist.toString()].assists += 1;
      }

      // CARDS
      if (event.card?.player) {
        ensurePlayer(event.card.player.toString());
        if (event.card.type === "YELLOW") {
          playerStatsMap[event.card.player.toString()].yellowCards += 1;
        }
        if (event.card.type === "RED") {
          playerStatsMap[event.card.player.toString()].redCards += 1;
        }
      }
    }

    /* ----------------------------------------------------
       GK CLEAN SHEET (GK ONLY)
    ---------------------------------------------------- */
   const applyGKCleanSheet = (lineup, conceded) => {
  if (!lineup?.starting || conceded !== 0) return;

  const gkSlot = lineup.starting.find(
    (s) => s.slotKey === "GK" && s.player
  );

  if (gkSlot?.player) {
    ensurePlayer(gkSlot.player.toString());
    playerStatsMap[gkSlot.player.toString()].cleanSheets += 1;
  }
};


    applyGKCleanSheet(match.lineups?.home, awayGoals);
    applyGKCleanSheet(match.lineups?.away, homeGoals);

    /* ----------------------------------------------------
       UPDATE PLAYERS (BULK)
    ---------------------------------------------------- */
    for (const playerId of playedPlayers) {
      const stats = playerStatsMap[playerId] || {};
      await Player.findByIdAndUpdate(
        playerId,
        {
          $inc: {
            matchesPlayed: 1,
            goals: stats.goals || 0,
            assists: stats.assists || 0,
            yellowCards: stats.yellowCards || 0,
            redCards: stats.redCards || 0,
            cleanSheets: stats.cleanSheets || 0,
          },
        },
        { session }
      );
    }

    /* ----------------------------------------------------
       FINAL MATCH UPDATE
    ---------------------------------------------------- */
    match.status = "COMPLETED";
    match.completedAt = new Date();
    match.winner = winner;

    await homeTeam.save({ session });
    await awayTeam.save({ session });
    await match.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({
      message: "Match ended successfully",
      score: match.score,
      winner,
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
        "name profileImageUrl position jerseyNumber"
      )
      .populate(
        "lineups.home.bench",
        "name profileImageUrl position jerseyNumber"
      )
      .populate(
        "lineups.away.starting.player",
        "name profileImageUrl position jerseyNumber"
      )
      .populate(
        "lineups.away.bench",
        "name profileImageUrl position jerseyNumber"
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
      const isHome =
        match.homeTeam._id.toString() === team._id.toString();
      const isAway =
        match.awayTeam._id.toString() === team._id.toString();

      const side = isHome ? "home" : isAway ? "away" : null;

      const lineupSubmitted =
        side && match.lineups?.[side]?.submittedAt;

     const canEditLineup =
  !!side &&
  !["LIVE", "COMPLETED"].includes(match.status);


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


