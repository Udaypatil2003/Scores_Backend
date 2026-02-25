const Tournament = require("../models/Tournament");
const Team = require("../models/Team");
const Match = require("../models/Match");
const mongoose = require("mongoose");
const { isOrganiserOwner } = require("../utils/organiserHelper");

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

    // ✅ Required field checks
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Tournament name is required" });
    }

    if (!format) {
      return res.status(400).json({ message: "Tournament format is required" });
    }

    if (!["KNOCKOUT", "LEAGUE"].includes(format)) {
      return res
        .status(400)
        .json({ message: "Format must be KNOCKOUT or LEAGUE" });
    }

    if (!startDate) {
      return res.status(400).json({ message: "Start date is required" });
    }

    if (!endDate) {
      return res.status(400).json({ message: "End date is required" });
    }

    // ✅ Date logic checks
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (isNaN(start.getTime())) {
      return res.status(400).json({ message: "Invalid start date" });
    }

    if (isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid end date" });
    }

    if (start < now) {
      return res
        .status(400)
        .json({ message: "Start date must be in the future" });
    }

    if (end <= start) {
      return res
        .status(400)
        .json({ message: "End date must be after start date" });
    }

    // ✅ Optional field checks
    if (entryFee !== undefined && (isNaN(entryFee) || entryFee < 0)) {
      return res
        .status(400)
        .json({ message: "Entry fee must be a positive number" });
    }

    if (maxTeams !== undefined && (isNaN(maxTeams) || maxTeams < 2)) {
      return res.status(400).json({ message: "Max teams must be at least 2" });
    }

    // ✅ Get organiser document
    const Organiser = require("../models/Organiser");
    const organiser = await Organiser.findOne({ user: req.user.id });
    if (!organiser) {
      return res.status(404).json({ message: "Organiser profile not found" });
    }

    const tournament = await Tournament.create({
      name: name.trim(),
      description: description?.trim() || "",
      format,
      startDate: start,
      endDate: end,
      venue: venue?.trim() || "",
      entryFee: entryFee ?? 0,
      maxTeams: maxTeams ?? null,
      organiser: organiser._id, // ✅ correct organiser _id not user _id
    });

    res.status(201).json(tournament);
  } catch (err) {
    console.error("Tournament create error:", err.message, err.errors);
    res.status(500).json({ message: err.message, errors: err.errors }); // ✅ send errors too
  }
};

exports.openRegistration = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    const isOwner = await isOrganiserOwner(req.user.id, tournament.organiser);
    if (!isOwner) {
      return res.status(403).json({ message: "Access denied" });
    }

    tournament.status = "REGISTRATION_OPEN";
    await tournament.save();

    res.json({ message: "Registration opened", tournament });
  } catch (err) {
    next(err);
  }
};

exports.closeRegistration = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    const isOwner = await isOrganiserOwner(req.user.id, tournament.organiser);
    if (!isOwner) {
      return res.status(403).json({ message: "Access denied" });
    }

    tournament.status = "REGISTRATION_CLOSED";
    await tournament.save();

    res.json({ message: "Registration closed", tournament });
  } catch (err) {
    next(err);
  }
};

exports.joinTournament = async (req, res) => {
  try {
    if (req.user.role !== "team") {
      return res
        .status(403)
        .json({ message: "Only teams can join tournaments" });
    }

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    if (tournament.status !== "REGISTRATION_OPEN") {
      return res.status(400).json({ message: "Registration is closed" });
    }

    const team = await Team.findOne({ createdBy: req.user.id });
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

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
  } catch (err) {
    console.error("joinTournament error:", err);
    res.status(500).json({ message: "Failed to join tournament" });
  }
};

// ================= End Tournament (FULLY FIXED) =================
exports.endTournament = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id).populate(
      "teams.team", "teamName teamLogoUrl",
    );

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    // ✅ Clean permission check using helper
    if (req.user.role !== "organiser") {
      return res.status(403).json({ message: "Only organisers can end tournaments" });
    }

    const isOwner = await isOrganiserOwner(req.user.id, tournament.organiser);
    if (!isOwner) {
      return res.status(403).json({ message: "Only tournament organiser can end the tournament" });
    }

    // rest of your existing endTournament logic stays exactly the same...
    if (tournament.status === "COMPLETED") {
      return res.status(400).json({ message: "Tournament is already completed" });
    }

    if (!["LIVE", "FIXTURES_GENERATED"].includes(tournament.status)) {
      return res.status(400).json({
        message: `Cannot end tournament with status: ${tournament.status}`,
      });
    }

    const tournamentMatches = await Match.find({ tournamentId: tournament._id });

    const incompleteMatches = tournamentMatches.filter(
      m => m.status !== "COMPLETED" && m.status !== "CANCELLED",
    );

    if (incompleteMatches.length > 0) {
      return res.status(400).json({
        message: `Cannot end tournament. ${incompleteMatches.length} match(es) still in progress.`,
        incompleteMatches: incompleteMatches.length,
      });
    }

    let winner = null;

    if (tournament.format === "KNOCKOUT") {
      const finalMatch = tournamentMatches
        .filter(m => m.status === "COMPLETED")
        .sort((a, b) => b.round - a.round)[0];

      if (finalMatch?.winner) winner = finalMatch.winner;
    }

    if (tournament.format === "LEAGUE") {
      const standings = await calculateLeagueStandings(tournament._id, tournamentMatches);
      if (standings?.length > 0) winner = standings[0].team._id;
    }

    tournament.status = "COMPLETED";
    tournament.winner = winner;
    tournament.completedAt = new Date();
    await tournament.save();
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
        completedMatches: tournamentMatches.filter(m => m.status === "COMPLETED").length,
      },
    });
  } catch (err) {
    next(err);
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

exports.getTournamentMatches = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    const isOrganiser =
      req.user.role === "organiser" &&
      (await isOrganiserOwner(req.user.id, tournament.organiser));

    const isTeamParticipant = req.user.role === "team";

    if (!isOrganiser && !isTeamParticipant) {
      return res.status(403).json({ message: "Access denied" });
    }

    const matches = await Match.find({ tournamentId: id })
      .populate("homeTeam", "teamName teamLogoUrl")
      .populate("awayTeam", "teamName teamLogoUrl")
      .populate("createdBy", "name role")
      .sort({ round: 1, scheduledAt: 1 })
      .lean();

    if (isTeamParticipant) {
      const team = await Team.findOne({ createdBy: req.user.id });
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      const teamMatches = matches.filter(
        m =>
          m.homeTeam._id.toString() === team._id.toString() ||
          m.awayTeam._id.toString() === team._id.toString(),
      );

      return res.json(teamMatches);
    }

    res.json(matches);
  } catch (err) {
    next(err);
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
