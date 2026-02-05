const Tournament = require("../models/Tournament");
const Team = require("../models/Team");
const Match = require("../models/Match");
const mongoose = require("mongoose");

// ---------------- CREATE TOURNAMENT ----------------
exports.createTournament = async (req, res) => {
  try {
    if (req.user.role !== "organiser") {
      return res
        .status(403)
        .json({ message: "Only organisers can create tournaments" });
    }

    const {
      name,
      description,
      format,
      startDate,
      endDate,
      venue,
      entryFee,
      maxTeams,
    } = req.body;

    const tournament = await Tournament.create({
      name,
      description,
      format,
      startDate,
      endDate,
      venue,
      entryFee,
      maxTeams,
      organiser: req.user.id,
    });

    res.status(201).json(tournament);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.openRegistration = async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organiser: req.user.id,
  });

  if (!tournament)
    return res.status(404).json({ message: "Tournament not found" });

  tournament.status = "REGISTRATION_OPEN";
  await tournament.save();

  res.json({ message: "Registration opened", tournament });
};

exports.closeRegistration = async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organiser: req.user.id,
  });

  if (!tournament)
    return res.status(404).json({ message: "Tournament not found" });

  tournament.status = "REGISTRATION_CLOSED";
  await tournament.save();

  res.json({ message: "Registration closed", tournament });
};

exports.openRegistration = async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organiser: req.user.id,
  });

  if (!tournament)
    return res.status(404).json({ message: "Tournament not found" });

  tournament.status = "REGISTRATION_OPEN";
  await tournament.save();

  res.json({ message: "Registration opened", tournament });
};

exports.closeRegistration = async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organiser: req.user.id,
  });

  if (!tournament)
    return res.status(404).json({ message: "Tournament not found" });

  tournament.status = "REGISTRATION_CLOSED";
  await tournament.save();

  res.json({ message: "Registration closed", tournament });
};

exports.joinTournament = async (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Only teams can join tournaments" });
  }

  const tournament = await Tournament.findById(req.params.id);
  if (!tournament)
    return res.status(404).json({ message: "Tournament not found" });

  if (tournament.status !== "REGISTRATION_OPEN") {
    return res.status(400).json({ message: "Registration is closed" });
  }

  const team = await Team.findOne({ createdBy: req.user.id });
  if (!team) return res.status(404).json({ message: "Team not found" });

  const alreadyJoined = tournament.teams.some(
    (t) => t.team.toString() === team._id.toString(),
  );

  if (alreadyJoined) {
    return res.status(400).json({ message: "Team already registered" });
  }

  // Date clash check
  const clash = await Match.findOne({
    $or: [{ homeTeam: team._id }, { awayTeam: team._id }],
    scheduledAt: {
      $gte: tournament.startDate,
      $lte: tournament.endDate,
    },
    status: { $in: ["ACCEPTED", "LIVE"] },
  });

  if (clash) {
    return res.status(400).json({
      message: "Team has another match/tournament during these dates",
    });
  }

  if (tournament.maxTeams && tournament.teams.length >= tournament.maxTeams) {
    return res.status(400).json({ message: "Tournament is full" });
  }

  tournament.teams.push({ team: team._id });
  await tournament.save();

  res.json({ message: "Joined tournament", tournament });
};

// ================= End Tournament (FULLY FIXED) =================
exports.endTournament = async (req, res) => {
  try {
    const { id } = req.params;

    // Find tournament - organiser might be ObjectId or populated object
    const tournament = await Tournament.findById(id).populate(
      "teams.team",
      "teamName teamLogoUrl",
    );

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    // ==================== PERMISSION CHECK ====================
    const isOrganiser = req.user.role === "organiser";

    // ⭐ FIXED: Handle both ObjectId and populated organiser
    const organiserId =
      typeof tournament.organiser === "object"
        ? tournament.organiser._id.toString()
        : tournament.organiser.toString();

    const isTournamentOrganiser = organiserId === req.user.id;

    if (!isOrganiser || !isTournamentOrganiser) {
      return res.status(403).json({
        message: "Only tournament organiser can end the tournament",
      });
    }

    // ==================== STATUS VALIDATION ====================
    if (tournament.status === "COMPLETED") {
      return res.status(400).json({
        message: "Tournament is already completed",
      });
    }

    if (!["LIVE", "FIXTURES_GENERATED"].includes(tournament.status)) {
      return res.status(400).json({
        message: `Cannot end tournament with status: ${tournament.status}`,
      });
    }

    // ==================== CHECK ALL MATCHES COMPLETED ====================
    const tournamentMatches = await Match.find({
      tournamentId: tournament._id,
    });

    const incompleteMatches = tournamentMatches.filter(
      (m) => m.status !== "COMPLETED" && m.status !== "CANCELLED",
    );

    if (incompleteMatches.length > 0) {
      return res.status(400).json({
        message: `Cannot end tournament. ${incompleteMatches.length} match(es) still in progress.`,
        incompleteMatches: incompleteMatches.length,
      });
    }

    // ==================== DETERMINE WINNER ====================
    let winner = null;

    if (tournament.format === "KNOCKOUT") {
      // Find the final match (highest round number)
      const finalMatch = tournamentMatches
        .filter((m) => m.status === "COMPLETED")
        .sort((a, b) => b.round - a.round)[0];

      if (finalMatch && finalMatch.winner) {
        winner = finalMatch.winner;
      }
    }

    if (tournament.format === "LEAGUE") {
      // Get standings to determine winner
      const standings = await calculateLeagueStandings(
        tournament._id,
        tournamentMatches,
      );

      if (standings && standings.length > 0) {
        winner = standings[0].team._id; // Top team wins
      }
    }

    // ==================== UPDATE TOURNAMENT STATUS ====================
    tournament.status = "COMPLETED";
    tournament.winner = winner;
    tournament.completedAt = new Date();

    await tournament.save();

    // ==================== POPULATE WINNER FOR RESPONSE ====================
    await tournament.populate("winner", "teamName teamLogoUrl");

    return res.json({
      message: "Tournament ended successfully",
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        status: tournament.status,
        winner: tournament.winner,
        completedAt: tournament.completedAt,
        format: tournament.format,
        totalMatches: tournamentMatches.length,
        completedMatches: tournamentMatches.filter(
          (m) => m.status === "COMPLETED",
        ).length,
      },
    });
  } catch (error) {
    console.error("END TOURNAMENT ERROR:", error);
    return res.status(500).json({
      message: "Failed to end tournament",
      error: error.message,
    });
  }
};

// ==================== HELPER: Calculate League Standings ====================
async function calculateLeagueStandings(tournamentId, matches) {
  const tournament = await Tournament.findById(tournamentId).populate(
    "teams.team",
    "teamName teamLogoUrl",
  );

  if (!tournament) return [];

  const teams = tournament.teams.map((t) => t.team);

  // Initialize stats for each team
  const standings = teams.map((team) => ({
    team: team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }));

  // Calculate stats from completed matches
  matches
    .filter((m) => m.status === "COMPLETED")
    .forEach((match) => {
      const homeIdx = standings.findIndex(
        (s) => s.team._id.toString() === match.homeTeam.toString(),
      );
      const awayIdx = standings.findIndex(
        (s) => s.team._id.toString() === match.awayTeam.toString(),
      );

      if (homeIdx === -1 || awayIdx === -1) return;

      const homeGoals = match.score?.home || 0;
      const awayGoals = match.score?.away || 0;

      // Update played
      standings[homeIdx].played += 1;
      standings[awayIdx].played += 1;

      // Update goals
      standings[homeIdx].goalsFor += homeGoals;
      standings[homeIdx].goalsAgainst += awayGoals;
      standings[awayIdx].goalsFor += awayGoals;
      standings[awayIdx].goalsAgainst += homeGoals;

      // Determine winner
      if (homeGoals > awayGoals) {
        standings[homeIdx].won += 1;
        standings[homeIdx].points += 3;
        standings[awayIdx].lost += 1;
      } else if (awayGoals > homeGoals) {
        standings[awayIdx].won += 1;
        standings[awayIdx].points += 3;
        standings[homeIdx].lost += 1;
      } else {
        standings[homeIdx].drawn += 1;
        standings[awayIdx].drawn += 1;
        standings[homeIdx].points += 1;
        standings[awayIdx].points += 1;
      }
    });

  // Calculate goal difference
  standings.forEach((s) => {
    s.goalDifference = s.goalsFor - s.goalsAgainst;
  });

  // Sort by: points, goal difference, goals for
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  return standings;
}

exports.getTournamentMatches = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify tournament exists and user is organiser
    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    // Only organiser or participating teams can view matches
    const isOrganiser =
      req.user.role === "organiser" &&
      tournament.organiser.toString() === req.user.id;

    const isTeamParticipant = req.user.role === "team";

    if (!isOrganiser && !isTeamParticipant) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get all matches for this tournament
    const matches = await Match.find({ tournamentId: id })
      .populate("homeTeam", "teamName teamLogoUrl")
      .populate("awayTeam", "teamName teamLogoUrl")
      .populate("createdBy", "name role")
      .sort({ round: 1, scheduledAt: 1 })
      .lean();

    // If team user, only show matches they're involved in
    if (isTeamParticipant) {
      const team = await Team.findOne({ createdBy: req.user.id });
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      const teamMatches = matches.filter(
        (m) =>
          m.homeTeam._id.toString() === team._id.toString() ||
          m.awayTeam._id.toString() === team._id.toString(),
      );

      return res.json(teamMatches);
    }

    // Organiser sees all matches
    res.json(matches);
  } catch (err) {
    console.error("Get tournament matches error:", err);
    res.status(500).json({ message: "Failed to load tournament matches" });
  }
};

exports.getTournament = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid tournament ID",
    });
  }

  const tournament = await Tournament.findById(id)
    .populate("organiser", "name")
    .populate("teams.team", "teamName teamLogoUrl")
    .populate("winner", "teamName teamLogoUrl"); // ✅ ADD THIS

  if (!tournament) {
    return res.status(404).json({ message: "Tournament not found" });
  }

  res.json(tournament);
};

// ---------------- SEARCH OPEN TOURNAMENTS (PAGINATED) ----------------
exports.searchOpenTournaments = async (req, res) => {
  try {
    if (req.user.role !== "team") {
      return res
        .status(403)
        .json({ message: "Only teams can access tournaments" });
    }

    const { q = "", location = "", fromDate, page = 1, limit = 10 } = req.query;

    const team = await Team.findOne({ createdBy: req.user.id });
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    /* ---------------- BASE FILTER ---------------- */
    const filter = {
      status: "REGISTRATION_OPEN",
      ...(q && { name: { $regex: q, $options: "i" } }),
      ...(location && { venue: { $regex: location, $options: "i" } }),
    };

    /* ---------------- DATE FILTER ---------------- */
    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(fromDate);
      end.setHours(23, 59, 59, 999);

      filter.startDate = { $gte: start, $lte: end };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const tournaments = await Tournament.find(filter)
      .select("name venue startDate maxTeams teams status")
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Tournament.countDocuments(filter);

    const data = tournaments.map((t) => {
      const joined = t.teams.some(
        (tm) => tm.team.toString() === team._id.toString(),
      );

      const isFull =
        typeof t.maxTeams === "number" && t.teams.length >= t.maxTeams;

      return {
        ...t,
        joined,
        isFull,
      };
    });

    res.json({
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        hasMore: skip + data.length < total,
      },
    });
  } catch (err) {
    console.error("Search open tournaments error:", err);
    res.status(500).json({ message: "Failed to fetch tournaments" });
  }
};

exports.getTournamentForTeam = async (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Access denied" });
  }

  const tournament = await Tournament.findById(req.params.id)
    .populate("organiser", "name")
    .populate("teams.team", "teamName teamLogoUrl");

  if (!tournament) {
    return res.status(404).json({ message: "Tournament not found" });
  }

  const team = await Team.findOne({ createdBy: req.user.id });
  if (!team) {
    return res.status(404).json({ message: "Team not found" });
  }

  const joinedEntry = tournament.teams.find(
    (t) => t.team._id.toString() === team._id.toString(),
  );

  const isJoined = !!joinedEntry;
  const isRegistrationOpen = tournament.status === "REGISTRATION_OPEN";
  const isFull =
    typeof tournament.maxTeams === "number" &&
    tournament.teams.length >= tournament.maxTeams;

  res.json({
    tournament,
    teamContext: {
      isJoined,
      joinedAt: joinedEntry?.joinedAt || null,
      canJoin: isRegistrationOpen && !isJoined && !isFull,
      canViewManagement: isJoined,
      reason: !isRegistrationOpen
        ? "REGISTRATION_CLOSED"
        : isFull
          ? "TOURNAMENT_FULL"
          : null,
    },
  });
};
