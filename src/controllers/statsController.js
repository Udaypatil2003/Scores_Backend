// controllers/stats.controller.js
const Match = require("../models/Match");
const Player = require("../models/Player");
const Team = require("../models/Team");
const Tournament = require("../models/Tournament");
const mongoose = require("mongoose");

/* ═══════════════════════════════════════════════
   HELPER — build stats map from match events
   Returns a Map keyed by playerId string
   ═══════════════════════════════════════════════ */
function buildPlayerStatsMap(matches) {
  const map = new Map();

  const get = (playerId) => {
    const key = playerId.toString();
    if (!map.has(key)) {
      map.set(key, {
        playerId: key,
        goals: 0,
        ownGoals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        matchesPlayed: 0,
        matchIds: new Set(),
        teamId: null,
        teamName: null,
      });
    }
    return map.get(key);
  };

  for (const match of matches) {
    if (match.status !== "COMPLETED") continue;

    const homeId = match.homeTeam?._id?.toString();
    const awayId = match.awayTeam?._id?.toString();

    // Track who played (from lineups)
    const allPlayers = [
      ...(match.lineups?.home?.starting?.map((s) => ({ player: s.player, teamId: homeId })) || []),
      ...(match.lineups?.home?.bench?.map((p) => ({ player: p, teamId: homeId })) || []),
      ...(match.lineups?.away?.starting?.map((s) => ({ player: s.player, teamId: awayId })) || []),
      ...(match.lineups?.away?.bench?.map((p) => ({ player: p, teamId: awayId })) || []),
    ];

    for (const { player, teamId } of allPlayers) {
      if (!player) continue;
      const entry = get(player._id || player);
      if (!entry.matchIds.has(match._id.toString())) {
        entry.matchIds.add(match._id.toString());
        entry.matchesPlayed++;
        entry.teamId = teamId;
      }
    }

    // Process events
    for (const event of match.events || []) {
      if (event.player) {
        const entry = get(event.player._id || event.player);
        entry.teamId = entry.teamId || event.team?.toString();

        if (event.type === "GOAL" || event.type === "PENALTY_GOAL") {
          entry.goals++;
        } else if (event.type === "OWN_GOAL") {
          entry.ownGoals++;
        } else if (event.type === "YELLOW") {
          entry.yellowCards++;
        } else if (event.type === "RED") {
          entry.redCards++;
        }
      }

      if (event.assistPlayer && (event.type === "GOAL" || event.type === "PENALTY_GOAL")) {
        const entry = get(event.assistPlayer._id || event.assistPlayer);
        entry.assists++;
      }
    }
  }

  return map;
}

/* ═══════════════════════════════════════════════
   HELPER — build team standings from matches
   ═══════════════════════════════════════════════ */
function buildStandings(matches, tournamentTeams) {
  const map = new Map();

  // Pre-seed all registered teams (even if they haven't played)
  for (const { team } of tournamentTeams) {
    if (!team) continue;
    const id = (team._id || team).toString();
    map.set(id, {
      teamId: id,
      teamName: team.teamName || "",
      teamLogoUrl: team.teamLogoUrl || "",
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      cleanSheets: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== "COMPLETED") continue;

    const homeId = match.homeTeam?._id?.toString();
    const awayId = match.awayTeam?._id?.toString();
    const hg = match.score?.home ?? 0;
    const ag = match.score?.away ?? 0;

    const home = map.get(homeId);
    const away = map.get(awayId);

    if (home) {
      home.played++;
      home.goalsFor += hg;
      home.goalsAgainst += ag;
      if (ag === 0) home.cleanSheets++;
      if (hg > ag) { home.wins++; home.points += 3; }
      else if (hg === ag) { home.draws++; home.points += 1; }
      else { home.losses++; }
    }

    if (away) {
      away.played++;
      away.goalsFor += ag;
      away.goalsAgainst += hg;
      if (hg === 0) away.cleanSheets++;
      if (ag > hg) { away.wins++; away.points += 3; }
      else if (ag === hg) { away.draws++; away.points += 1; }
      else { away.losses++; }
    }
  }

  // Compute GD and sort: points → GD → goalsFor
  const standings = Array.from(map.values())
    .map((t) => ({ ...t, goalDifference: t.goalsFor - t.goalsAgainst }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    })
    .map((t, i) => ({ ...t, position: i + 1 }));

  return standings;
}

/* ═══════════════════════════════════════════════
   1. GET /api/tournament/:tournamentId/stats
   ═══════════════════════════════════════════════ */
exports.getTournamentStats = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await Tournament.findById(tournamentId).populate(
      "teams.team",
      "teamName teamLogoUrl"
    );
    if (!tournament) return res.status(404).json({ message: "Tournament not found" });

    // Fetch all completed + live matches for this tournament
    const matches = await Match.find({ tournamentId })
      .populate("homeTeam", "teamName teamLogoUrl")
      .populate("awayTeam", "teamName teamLogoUrl")
      .populate("events.player", "name")
      .populate("events.assistPlayer", "name")
      .populate("lineups.home.starting.player", "name")
      .populate("lineups.away.starting.player", "name")
      .lean();

    const completedMatches = matches.filter((m) => m.status === "COMPLETED");

    // ── Overview ──
    const totalGoals = completedMatches.reduce(
      (sum, m) => sum + (m.score?.home ?? 0) + (m.score?.away ?? 0),
      0
    );
    const totalYellowCards = completedMatches.reduce(
      (sum, m) => sum + m.events.filter((e) => e.type === "YELLOW").length,
      0
    );
    const totalRedCards = completedMatches.reduce(
      (sum, m) => sum + m.events.filter((e) => e.type === "RED").length,
      0
    );
    const cleanSheets = completedMatches.reduce((sum, m) => {
      let cs = 0;
      if ((m.score?.away ?? 0) === 0) cs++;
      if ((m.score?.home ?? 0) === 0) cs++;
      return sum + cs;
    }, 0);

    const overview = {
      totalMatches: completedMatches.length,
      totalGoals,
      avgGoalsPerMatch: completedMatches.length > 0
        ? totalGoals / completedMatches.length
        : 0,
      teamsCount: tournament.teams.length,
      cleanSheets,
      totalYellowCards,
      totalRedCards,
    };

    // ── Standings ──
    const standings = buildStandings(matches, tournament.teams);

    // ── Player stats map ──
    const playerMap = buildPlayerStatsMap(matches);

    // Enrich with player names by fetching all player docs in one query
    const playerIds = Array.from(playerMap.keys()).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const playerDocs = await Player.find({ _id: { $in: playerIds } })
      .populate("teamId", "teamName")
      .select("name teamId")
      .lean();

    const playerNameMap = new Map(
      playerDocs.map((p) => [
        p._id.toString(),
        { name: p.name, teamName: p.teamId?.teamName || "—" },
      ])
    );

    const enrichedPlayers = Array.from(playerMap.values()).map((p) => ({
      ...p,
      playerName: playerNameMap.get(p.playerId)?.name || "Unknown",
      teamName: playerNameMap.get(p.playerId)?.teamName || "—",
      matchesPlayed: p.matchIds.size,
    }));

    const topScorers = [...enrichedPlayers]
      .filter((p) => p.goals > 0)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
      .slice(0, 10);

    const topAssists = [...enrichedPlayers]
      .filter((p) => p.assists > 0)
      .sort((a, b) => b.assists - a.assists)
      .slice(0, 10);

    const mostYellowCards = [...enrichedPlayers]
      .filter((p) => p.yellowCards > 0)
      .sort((a, b) => b.yellowCards - a.yellowCards)
      .slice(0, 10);

    // ── Recent results ──
    const recentResults = completedMatches
      .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt))
      .slice(0, 5)
      .map((m) => ({
        _id: m._id,
        homeTeam: { teamName: m.homeTeam?.teamName },
        awayTeam: { teamName: m.awayTeam?.teamName },
        score: m.score,
        status: m.status,
      }));

    res.json({
      overview,
      standings,
      topScorers,
      topAssists,
      mostYellowCards,
      recentResults,
    });
  } catch (err) {
    console.error("getTournamentStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ═══════════════════════════════════════════════
   2. GET /api/team/:teamId/stats?tournamentId=xxx
   ═══════════════════════════════════════════════ */
exports.getTeamStats = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { tournamentId } = req.query;

    const team = await Team.findById(teamId)
      .populate("players", "name position jerseyNumber profileImageUrl")
      .lean();
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Build match query
    const matchQuery = {
      $or: [{ homeTeam: teamId }, { awayTeam: teamId }],
      status: "COMPLETED",
    };
    if (tournamentId) matchQuery.tournamentId = tournamentId;

    const matches = await Match.find(matchQuery)
      .populate("homeTeam", "teamName teamLogoUrl _id")
      .populate("awayTeam", "teamName teamLogoUrl _id")
      .populate("events.player", "name _id")
      .populate("events.assistPlayer", "name _id")
      .sort({ scheduledAt: 1 })
      .lean();

    // ── W/D/L record ──
    let wins = 0, draws = 0, losses = 0;
    let goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;

    const matchHistory = matches.map((m) => {
      const isHome = m.homeTeam?._id?.toString() === teamId;
      const myGoals = isHome ? m.score?.home ?? 0 : m.score?.away ?? 0;
      const oppGoals = isHome ? m.score?.away ?? 0 : m.score?.home ?? 0;
      const opponent = isHome ? m.awayTeam : m.homeTeam;

      goalsFor += myGoals;
      goalsAgainst += oppGoals;
      if (oppGoals === 0) cleanSheets++;

      let result;
      if (myGoals > oppGoals) { wins++; result = "W"; }
      else if (myGoals === oppGoals) { draws++; result = "D"; }
      else { losses++; result = "L"; }

      return {
        _id: m._id,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        score: m.score,
        status: m.status,
        scheduledAt: m.scheduledAt,
        round: m.round,
        result,
        opponentName: opponent?.teamName,
        myGoals,
        oppGoals,
      };
    });

    // Form guide (last 5)
    const form = matchHistory.slice(-5).map((m) => m.result);

    // Total points (league)
    const totalPoints = wins * 3 + draws;

    // ── Player stats from events ──
    const playerStatsMap = new Map();

    const initPlayer = (id, name) => {
      if (!playerStatsMap.has(id)) {
        playerStatsMap.set(id, {
          playerId: id,
          playerName: name || "Unknown",
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          matchIds: new Set(),
        });
      }
      return playerStatsMap.get(id);
    };

    // Count matches played from lineups
    for (const match of matches) {
      const isHome = match.homeTeam?._id?.toString() === teamId;
      const myLineup = isHome ? match.lineups?.home : match.lineups?.away;
      const starters = myLineup?.starting?.map((s) => s.player).filter(Boolean) || [];
      const bench = myLineup?.bench?.filter(Boolean) || [];

      for (const player of [...starters, ...bench]) {
        const pid = (player._id || player).toString();
        const pEntry = initPlayer(pid, player.name);
        pEntry.matchIds.add(match._id.toString());
      }

      // Events for this team
      for (const event of match.events || []) {
        if (event.team?.toString() !== teamId && event.team?._id?.toString() !== teamId) continue;

        if (event.player) {
          const pid = (event.player._id || event.player).toString();
          const pEntry = initPlayer(pid, event.player.name);
          if (event.type === "GOAL" || event.type === "PENALTY_GOAL") pEntry.goals++;
          if (event.type === "YELLOW") pEntry.yellowCards++;
          if (event.type === "RED") pEntry.redCards++;
        }
        if (event.assistPlayer && (event.type === "GOAL" || event.type === "PENALTY_GOAL")) {
          const pid = (event.assistPlayer._id || event.assistPlayer).toString();
          const pEntry = initPlayer(pid, event.assistPlayer.name);
          pEntry.assists++;
        }
      }
    }

    const players = Array.from(playerStatsMap.values())
      .map((p) => ({ ...p, matchesPlayed: p.matchIds.size }))
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists);

    // ── Standings position (if tournamentId) ──
    let position = null;
    if (tournamentId) {
      const tournament = await Tournament.findById(tournamentId).populate(
        "teams.team",
        "teamName teamLogoUrl"
      );
      if (tournament) {
        const allMatches = await Match.find({ tournamentId })
          .populate("homeTeam awayTeam", "teamName teamLogoUrl")
          .lean();
        const standings = buildStandings(allMatches, tournament.teams);
        const myStanding = standings.find((s) => s.teamId === teamId);
        position = myStanding?.position || null;
      }
    }

    res.json({
      team: {
        teamName: team.teamName,
        teamLogoUrl: team.teamLogoUrl,
        location: team.location,
      },
      record: {
        position,
        played: matches.length,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        cleanSheets,
        totalPoints,
      },
      form,
      players,
      matches: matchHistory,
    });
  } catch (err) {
    console.error("getTeamStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ═══════════════════════════════════════════════
   3. GET /api/player/:playerId/stats?tournamentId=xxx
   ═══════════════════════════════════════════════ */
exports.getPlayerStats = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { tournamentId } = req.query;

    const player = await Player.findById(playerId)
      .populate("teamId", "teamName teamLogoUrl")
      .lean();
    if (!player) return res.status(404).json({ message: "Player not found" });

    // Find all completed matches involving this player
    const matchQuery = {
      status: "COMPLETED",
      $or: [
        { "lineups.home.starting.player": playerId },
        { "lineups.home.bench": playerId },
        { "lineups.away.starting.player": playerId },
        { "lineups.away.bench": playerId },
        { "events.player": playerId },
        { "events.assistPlayer": playerId },
      ],
    };
    if (tournamentId) matchQuery.tournamentId = tournamentId;

    const matches = await Match.find(matchQuery)
      .populate("homeTeam", "teamName _id")
      .populate("awayTeam", "teamName _id")
      .populate("events.player", "name _id")
      .populate("events.assistPlayer", "name _id")
      .sort({ scheduledAt: 1 })
      .lean();

    // ── Per-match aggregation ──
    let totalGoals = 0;
    let totalAssists = 0;
    let totalYellowCards = 0;
    let totalRedCards = 0;
    let matchesPlayed = 0;

    const matchLog = [];

    for (const match of matches) {
      const teamId = player.teamId?._id?.toString() || player.teamId?.toString();
      const isHome = match.homeTeam?._id?.toString() === teamId;
      const myGoals = isHome ? match.score?.home ?? 0 : match.score?.away ?? 0;
      const oppGoals = isHome ? match.score?.away ?? 0 : match.score?.home ?? 0;
      const opponent = isHome ? match.awayTeam : match.homeTeam;

      let matchGoals = 0;
      let matchAssists = 0;
      let yellowCard = false;
      let redCard = false;

      for (const event of match.events || []) {
        const pid = (event.player?._id || event.player)?.toString();
        const apid = (event.assistPlayer?._id || event.assistPlayer)?.toString();

        if (pid === playerId) {
          if (event.type === "GOAL" || event.type === "PENALTY_GOAL") matchGoals++;
          if (event.type === "YELLOW") yellowCard = true;
          if (event.type === "RED") redCard = true;
        }
        if (apid === playerId && (event.type === "GOAL" || event.type === "PENALTY_GOAL")) {
          matchAssists++;
        }
      }

      totalGoals += matchGoals;
      totalAssists += matchAssists;
      if (yellowCard) totalYellowCards++;
      if (redCard) totalRedCards++;
      matchesPlayed++;

      let result = myGoals > oppGoals ? "W" : myGoals === oppGoals ? "D" : "L";

      matchLog.push({
        matchId: match._id,
        opponentName: opponent?.teamName || "Opponent",
        date: match.scheduledAt,
        round: match.round ? `Round ${match.round}` : null,
        result,
        goals: matchGoals,
        assists: matchAssists,
        yellowCard,
        redCard,
        minutesPlayed: 90, // No minute tracking per player yet — default 90
      });
    }

    // ── Rankings (if tournamentId) ──
    let rankings = {};
    if (tournamentId) {
      // Get all players' stats in this tournament to rank
      const tourneyMatches = await Match.find({ tournamentId, status: "COMPLETED" })
        .populate("events.player", "_id")
        .populate("events.assistPlayer", "_id")
        .lean();

      const allPlayerMap = buildPlayerStatsMap(tourneyMatches);
      const allPlayers = Array.from(allPlayerMap.values());

      const sortedByGoals = [...allPlayers].sort((a, b) => b.goals - a.goals);
      const sortedByAssists = [...allPlayers].sort((a, b) => b.assists - a.assists);

      const goalRank = sortedByGoals.findIndex((p) => p.playerId === playerId) + 1;
      const assistRank = sortedByAssists.findIndex((p) => p.playerId === playerId) + 1;

      rankings = {
        goalRank: goalRank > 0 ? goalRank : null,
        assistRank: assistRank > 0 ? assistRank : null,
        totalPlayers: allPlayers.length,
      };
    }

    res.json({
      player: {
        name: player.name,
        teamName: player.teamId?.teamName || "—",
        position: player.position,
        jerseyNumber: player.jerseyNumber,
        profileImageUrl: player.profileImageUrl,
      },
      performance: {
        goals: totalGoals,
        assists: totalAssists,
        yellowCards: totalYellowCards,
        redCards: totalRedCards,
        matchesPlayed,
        minutesPlayed: matchesPlayed * 90, // approximate until you add per-player minutes
      },
      rankings,
      matchLog,
    });
  } catch (err) {
    console.error("getPlayerStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};