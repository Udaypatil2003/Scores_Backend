// tournamentController.js - FIXTURE GENERATION SYSTEM

const Tournament = require("../models/Tournament");
const Team = require("../models/Team");
const Match = require("../models/Match");
const mongoose = require("mongoose");

// ================= GENERATE FIXTURES =================
exports.generateFixtures = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify organiser owns tournament
    const tournament = await Tournament.findOne({
      _id: id,
      organiser: req.user.id,
    }).populate("teams.team");

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    if (tournament.status !== "REGISTRATION_CLOSED") {
      return res.status(400).json({ 
        message: "Close registration first before generating fixtures" 
      });
    }

    const teams = tournament.teams.map(t => t.team);
    
    if (teams.length < 2) {
      return res.status(400).json({ 
        message: "Need at least 2 teams to generate fixtures" 
      });
    }

    // Delete any existing fixtures for this tournament
    await Match.deleteMany({ tournamentId: tournament._id });

    let matches;
    let fixtureType;

    if (tournament.format === "KNOCKOUT") {
      matches = generateKnockoutFixtures(tournament, teams, req.user.id);
      fixtureType = "knockout";
    } else if (tournament.format === "LEAGUE") {
      matches = generateLeagueFixtures(tournament, teams, req.user.id);
      fixtureType = "league";
    } else {
      return res.status(400).json({ message: "Invalid tournament format" });
    }

    // Insert all matches
    await Match.insertMany(matches);

    tournament.status = "FIXTURES_GENERATED";
    await tournament.save();

    res.json({
      message: "Fixtures generated successfully",
      fixtureType,
      totalMatches: matches.length,
      totalRounds: tournament.format === "KNOCKOUT" 
        ? Math.ceil(Math.log2(teams.length))
        : teams.length - 1,
    });

  } catch (err) {
    console.error("Generate fixtures error:", err);
    res.status(500).json({ 
      message: err.message || "Failed to generate fixtures" 
    });
  }
};

// ================= KNOCKOUT FIXTURE GENERATOR =================
function generateKnockoutFixtures(tournament, teams, organiserId) {
  const matches = [];
  
  // Shuffle teams for random draw
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  
  // Calculate first round matches
  const numTeams = shuffledTeams.length;
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numTeams)));
  const byes = nextPowerOf2 - numTeams;
  
  let round = 1;
  let matchDate = new Date(tournament.startDate);
  
  // First round
  const firstRoundTeams = shuffledTeams.slice(0, numTeams - byes);
  
  for (let i = 0; i < firstRoundTeams.length; i += 2) {
    if (firstRoundTeams[i + 1]) {
      matches.push({
        createdBy: organiserId,
        createdByRole: "organiser",
        homeTeam: firstRoundTeams[i]._id,
        awayTeam: firstRoundTeams[i + 1]._id,
        scheduledAt: new Date(matchDate),
        status: "PENDING",
        tournamentId: tournament._id,
        round,
        matchType: "Tournament",
        venue: tournament.venue || "",
      });
    }
  }
  
  return matches;
}

// ================= LEAGUE FIXTURE GENERATOR (ROUND ROBIN) =================
function generateLeagueFixtures(tournament, teams, organiserId) {
  const matches = [];
  const numTeams = teams.length;
  
  // If odd number of teams, add a "BYE" placeholder
  const teamsForRobin = numTeams % 2 === 0 
    ? [...teams] 
    : [...teams, null];
  
  const totalRounds = teamsForRobin.length - 1;
  const matchesPerRound = Math.floor(teamsForRobin.length / 2);
  
  let matchDate = new Date(tournament.startDate);
  
  for (let round = 0; round < totalRounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const home = (round + match) % (teamsForRobin.length - 1);
      const away = (teamsForRobin.length - 1 - match + round) % (teamsForRobin.length - 1);
      
      // Last team stays in place, rotates opponent
      const homeTeam = match === 0 ? teamsForRobin[teamsForRobin.length - 1] : teamsForRobin[home];
      const awayTeam = teamsForRobin[away];
      
      // Skip if either team is null (BYE round)
      if (homeTeam && awayTeam) {
        matches.push({
          createdBy: organiserId,
          createdByRole: "organiser",
          homeTeam: homeTeam._id,
          awayTeam: awayTeam._id,
          scheduledAt: new Date(matchDate),
          status: "PENDING",
          tournamentId: tournament._id,
          round: round + 1,
          matchType: "Tournament",
          venue: tournament.venue || "",
        });
      }
    }
    
    // Move to next week for next round
    matchDate.setDate(matchDate.getDate() + 7);
  }
  
  return matches;
}

// ================= GET TOURNAMENT FIXTURES =================
exports.getTournamentFixtures = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    // Only organiser can view fixtures before they're public
    const isOrganiser = 
      req.user.role === "organiser" && 
      tournament.organiser.toString() === req.user.id;

    const isTeam = req.user.role === "team";

    if (!isOrganiser && !isTeam) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get all matches grouped by round
    const matches = await Match.find({ tournamentId: id })
      .populate("homeTeam", "teamName teamLogoUrl")
      .populate("awayTeam", "teamName teamLogoUrl")
      .sort({ round: 1, scheduledAt: 1 })
      .lean();

    // Group by round
    const fixturesByRound = {};
    
    matches.forEach(match => {
      const roundKey = match.round || 1;
      if (!fixturesByRound[roundKey]) {
        fixturesByRound[roundKey] = [];
      }
      fixturesByRound[roundKey].push(match);
    });

    res.json({
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        format: tournament.format,
        status: tournament.status,
      },
      fixtures: fixturesByRound,
      totalMatches: matches.length,
      totalRounds: Object.keys(fixturesByRound).length,
    });

  } catch (err) {
    console.error("Get tournament fixtures error:", err);
    res.status(500).json({ message: "Failed to load fixtures" });
  }
};

// ================= MANUAL SEEDING =================
exports.updateSeeding = async (req, res) => {
  try {
    const { id } = req.params;
    const { seeding } = req.body; // Array of team IDs in order

    const tournament = await Tournament.findOne({
      _id: id,
      organiser: req.user.id,
    });

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    if (tournament.status !== "REGISTRATION_CLOSED") {
      return res.status(400).json({ 
        message: "Can only update seeding after registration closes" 
      });
    }

    // Validate seeding array
    if (!Array.isArray(seeding) || seeding.length !== tournament.teams.length) {
      return res.status(400).json({ 
        message: "Invalid seeding. Must include all teams exactly once." 
      });
    }

    // Reorder teams array
    const newTeamsOrder = seeding.map(teamId => {
      const teamEntry = tournament.teams.find(
        t => t.team.toString() === teamId.toString()
      );
      if (!teamEntry) {
        throw new Error(`Team ${teamId} not found in tournament`);
      }
      return teamEntry;
    });

    tournament.teams = newTeamsOrder;
    await tournament.save();

    res.json({ 
      message: "Seeding updated successfully",
      teams: newTeamsOrder,
    });

  } catch (err) {
    console.error("Update seeding error:", err);
    res.status(500).json({ 
      message: err.message || "Failed to update seeding" 
    });
  }
};

// ================= START TOURNAMENT =================
exports.startTournament = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findOne({
      _id: id,
      organiser: req.user.id,
    });

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    if (tournament.status !== "FIXTURES_GENERATED") {
      return res.status(400).json({ 
        message: "Generate fixtures before starting tournament" 
      });
    }

    // Check if there are matches
    const matchCount = await Match.countDocuments({ tournamentId: id });
    
    if (matchCount === 0) {
      return res.status(400).json({ 
        message: "No fixtures found. Generate fixtures first." 
      });
    }

    tournament.status = "LIVE";
    await tournament.save();

    res.json({ 
      message: "Tournament started successfully",
      tournament,
    });

  } catch (err) {
    console.error("Start tournament error:", err);
    res.status(500).json({ message: "Failed to start tournament" });
  }
};

// ================= ADVANCE KNOCKOUT ROUND =================
exports.advanceKnockoutRound = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findOne({
      _id: id,
      organiser: req.user.id,
    });

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    if (tournament.format !== "KNOCKOUT") {
      return res.status(400).json({ 
        message: "This endpoint is only for knockout tournaments" 
      });
    }

    // Get current round matches
    const currentRound = await Match.find({ 
      tournamentId: id 
    })
      .sort({ round: -1 })
      .limit(1)
      .select("round");

    if (!currentRound.length) {
      return res.status(400).json({ message: "No matches found" });
    }

    const latestRound = currentRound[0].round;

    // Check if all matches in current round are completed
    const roundMatches = await Match.find({
      tournamentId: id,
      round: latestRound,
    });

    const allCompleted = roundMatches.every(m => m.status === "COMPLETED");

    if (!allCompleted) {
      return res.status(400).json({ 
        message: "All matches in current round must be completed first" 
      });
    }

    // Get winners
    const winners = roundMatches
      .filter(m => m.winner)
      .map(m => m.winner);

    if (winners.length < 2) {
      return res.status(400).json({ 
        message: "Not enough winners to create next round" 
      });
    }

    // Create next round matches
    const nextRound = latestRound + 1;
    const nextMatches = [];
    const matchDate = new Date(roundMatches[0].scheduledAt);
    matchDate.setDate(matchDate.getDate() + 7); // Week later

    for (let i = 0; i < winners.length; i += 2) {
      if (winners[i + 1]) {
        nextMatches.push({
          createdBy: req.user.id,
          createdByRole: "organiser",
          homeTeam: winners[i],
          awayTeam: winners[i + 1],
          scheduledAt: new Date(matchDate),
          status: "PENDING",
          tournamentId: tournament._id,
          round: nextRound,
          matchType: "Tournament",
          venue: tournament.venue || "",
        });
      }
    }

    if (nextMatches.length > 0) {
      await Match.insertMany(nextMatches);
    }

    // Check if this was the final
    if (nextMatches.length === 0 && winners.length === 1) {
      tournament.status = "COMPLETED";
      await tournament.save();
    }

    res.json({
      message: nextMatches.length > 0 
        ? `Round ${nextRound} created with ${nextMatches.length} matches`
        : "Tournament completed",
      nextRound: nextMatches.length > 0 ? nextRound : null,
      matchesCreated: nextMatches.length,
    });

  } catch (err) {
    console.error("Advance round error:", err);
    res.status(500).json({ message: "Failed to advance round" });
  }
};

// ================= GET STANDINGS (LEAGUE) =================
exports.getStandings = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await Tournament.findById(id).populate("teams.team");

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    if (tournament.format !== "LEAGUE") {
      return res.status(400).json({ 
        message: "Standings only available for league tournaments" 
      });
    }

    // Get all completed matches
    const matches = await Match.find({
      tournamentId: id,
      status: "COMPLETED",
    });

    // Calculate standings
    const standings = {};

    tournament.teams.forEach(t => {
      standings[t.team._id] = {
        team: t.team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
    });

    matches.forEach(match => {
      const homeId = match.homeTeam.toString();
      const awayId = match.awayTeam.toString();

      if (standings[homeId]) {
        standings[homeId].played++;
        standings[homeId].goalsFor += match.score.home;
        standings[homeId].goalsAgainst += match.score.away;
      }

      if (standings[awayId]) {
        standings[awayId].played++;
        standings[awayId].goalsFor += match.score.away;
        standings[awayId].goalsAgainst += match.score.home;
      }

      if (match.score.home > match.score.away) {
        // Home win
        if (standings[homeId]) {
          standings[homeId].won++;
          standings[homeId].points += 3;
        }
        if (standings[awayId]) {
          standings[awayId].lost++;
        }
      } else if (match.score.home < match.score.away) {
        // Away win
        if (standings[awayId]) {
          standings[awayId].won++;
          standings[awayId].points += 3;
        }
        if (standings[homeId]) {
          standings[homeId].lost++;
        }
      } else {
        // Draw
        if (standings[homeId]) {
          standings[homeId].drawn++;
          standings[homeId].points++;
        }
        if (standings[awayId]) {
          standings[awayId].drawn++;
          standings[awayId].points++;
        }
      }
    });

    // Calculate goal difference and sort
    const standingsArray = Object.values(standings).map(s => ({
      ...s,
      goalDifference: s.goalsFor - s.goalsAgainst,
    }));

    standingsArray.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) 
        return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    res.json({
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        format: tournament.format,
      },
      standings: standingsArray,
    });

  } catch (err) {
    console.error("Get standings error:", err);
    res.status(500).json({ message: "Failed to load standings" });
  }
};

module.exports = exports;