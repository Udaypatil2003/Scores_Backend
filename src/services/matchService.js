const mongoose = require("mongoose");
const Match = require("../models/Match");
const Player = require("../models/Player");
const Team = require("../models/Team");

const endMatchAndUpdateStats = async (matchId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const match = await Match.findById(matchId).session(session);

    if (!match) throw new Error("Match not found");
    if (match.status !== "LIVE") throw new Error("Match is not live");

    const homeGoals = match.score.home;
    const awayGoals = match.score.away;

    // -------- WINNER --------
    let winner = null;
    if (homeGoals > awayGoals) winner = match.homeTeam;
    if (awayGoals > homeGoals) winner = match.awayTeam;

    // -------- TEAM STATS --------
    const homeTeam = await Team.findById(match.homeTeam).session(session);
    const awayTeam = await Team.findById(match.awayTeam).session(session);

    if (!homeTeam || !awayTeam) throw new Error("Teams not found");

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

    // -------- PLAYER PARTICIPATION --------
    const playedPlayers = new Set();

    match.lineups?.home?.starting?.forEach((p) => {
      if (p?.player) playedPlayers.add(p.player.toString());
    });
    match.lineups?.away?.starting?.forEach((p) => {
      if (p?.player) playedPlayers.add(p.player.toString());
    });

    // Substituted-in players
    match.events
      .filter((e) => e.type === "SUBSTITUTION" && e.substitutedPlayer)
      .forEach((e) => playedPlayers.add(e.substitutedPlayer.toString()));

    // -------- PLAYER STATS FROM EVENTS --------
    const playerStatsMap = {};

    const ensurePlayer = (id) => {
      const key = id.toString();
      if (!playerStatsMap[key]) {
        playerStatsMap[key] = {
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          cleanSheets: 0,
        };
      }
    };

    for (const event of match.events || []) {
      if (["GOAL", "PENALTY_GOAL"].includes(event.type) && event.player) {
        ensurePlayer(event.player);
        playerStatsMap[event.player.toString()].goals += 1;
      }
      if (["GOAL", "PENALTY_GOAL"].includes(event.type) && event.assistPlayer) {
        ensurePlayer(event.assistPlayer);
        playerStatsMap[event.assistPlayer.toString()].assists += 1;
      }
      if (event.type === "YELLOW" && event.player) {
        ensurePlayer(event.player);
        playerStatsMap[event.player.toString()].yellowCards += 1;
      }
      if (event.type === "RED" && event.player) {
        ensurePlayer(event.player);
        playerStatsMap[event.player.toString()].redCards += 1;
      }
    }

    // -------- GK CLEAN SHEET --------
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

    // -------- BULK PLAYER UPDATE --------
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

    // -------- FINAL MATCH UPDATE --------
    match.status = "COMPLETED";
    match.completedAt = new Date();
    match.winner = winner;

    await homeTeam.save({ session });
    await awayTeam.save({ session });
    await match.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { success: true, match, winner };

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

module.exports = { endMatchAndUpdateStats };