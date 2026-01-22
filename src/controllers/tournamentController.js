const Tournament = require("../models/Tournament");
const Team = require("../models/Team");
const Match = require("../models/Match");
const mongoose = require("mongoose");


// ---------------- CREATE TOURNAMENT ----------------
exports.createTournament = async (req, res) => {
  try {
    if (req.user.role !== "organiser") {
      return res.status(403).json({ message: "Only organisers can create tournaments" });
    }

    const { name, description, format, startDate, endDate, venue, entryFee, maxTeams } = req.body;

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

  if (!tournament) return res.status(404).json({ message: "Tournament not found" });

  tournament.status = "REGISTRATION_OPEN";
  await tournament.save();

  res.json({ message: "Registration opened", tournament });
};

exports.closeRegistration = async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organiser: req.user.id,
  });

  if (!tournament) return res.status(404).json({ message: "Tournament not found" });

  tournament.status = "REGISTRATION_CLOSED";
  await tournament.save();

  res.json({ message: "Registration closed", tournament });
};


exports.openRegistration = async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organiser: req.user.id,
  });

  if (!tournament) return res.status(404).json({ message: "Tournament not found" });

  tournament.status = "REGISTRATION_OPEN";
  await tournament.save();

  res.json({ message: "Registration opened", tournament });
};

exports.closeRegistration = async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organiser: req.user.id,
  });

  if (!tournament) return res.status(404).json({ message: "Tournament not found" });

  tournament.status = "REGISTRATION_CLOSED";
  await tournament.save();

  res.json({ message: "Registration closed", tournament });
};


exports.joinTournament = async (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Only teams can join tournaments" });
  }

  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) return res.status(404).json({ message: "Tournament not found" });

  if (tournament.status !== "REGISTRATION_OPEN") {
    return res.status(400).json({ message: "Registration is closed" });
  }

  const team = await Team.findOne({ createdBy: req.user.id });
  if (!team) return res.status(404).json({ message: "Team not found" });

  const alreadyJoined = tournament.teams.some(t =>
    t.team.toString() === team._id.toString()
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


exports.generateFixtures = async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organiser: req.user.id,
  }).populate("teams.team");

  if (!tournament) return res.status(404).json({ message: "Tournament not found" });

  if (tournament.status !== "REGISTRATION_CLOSED") {
    return res.status(400).json({ message: "Close registration first" });
  }

  const teams = tournament.teams.map(t => t.team);
  if (teams.length < 2) {
    return res.status(400).json({ message: "Not enough teams" });
  }

  // Shuffle teams
  teams.sort(() => Math.random() - 0.5);

  const matches = [];

  for (let i = 0; i < teams.length; i += 2) {
    if (!teams[i + 1]) break;

    matches.push({
      createdBy: req.user.id,
      createdByRole: "organiser",
      homeTeam: teams[i]._id,
      awayTeam: teams[i + 1]._id,
      scheduledAt: tournament.startDate,
      status: "PENDING",
      tournamentId: tournament._id,
      round: 1,
    });
  }

  await Match.insertMany(matches);

  tournament.status = "FIXTURES_GENERATED";
  await tournament.save();

  res.json({ message: "Fixtures generated", matchesCount: matches.length });
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
    .populate("teams.team", "teamName teamLogoUrl");

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

    const {
      q = "",
      location = "",
      fromDate,
      page = 1,
      limit = 10,
    } = req.query;

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
        (tm) => tm.team.toString() === team._id.toString()
      );

      const isFull =
        typeof t.maxTeams === "number" &&
        t.teams.length >= t.maxTeams;

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
    t => t.team._id.toString() === team._id.toString()
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
      reason:
        !isRegistrationOpen
          ? "REGISTRATION_CLOSED"
          : isFull
          ? "TOURNAMENT_FULL"
          : null,
    },
  });
};








