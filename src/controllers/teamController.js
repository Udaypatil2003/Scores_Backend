// const Team = require("../models/Team");
// const Player = require("../models/Player");
// const { uploadImage } = require("../utils/uploadImage");
// const Tournament = require("../models/Tournament");
// const Match = require("../models/Match");

// // ---------------- Create TEAM ----------------
// exports.createTeam = async (req, res) => {
//   try {
//     const { teamName, description, location, foundedYear } = req.body;

//     let teamLogoUrl = "";
//     let coverImageUrl = "";

//     // Upload logo if provided
//     if (req.files?.teamLogo?.[0]) {
//       teamLogoUrl = await uploadImage(
//         req.files.teamLogo[0].buffer,
//         "teams"
//       );
//     }

//     // Upload cover if provided
//     if (req.files?.coverImage?.[0]) {
//       coverImageUrl = await uploadImage(
//         req.files.coverImage[0].buffer,
//         "teams"
//       );
//     }

//     const team = await Team.create({
//       teamName,
//       description,
//       location,
//       foundedYear,
//       teamLogoUrl,
//       coverImageUrl,
//       createdBy: req.user.id,
//       admins: [req.user.id],
//     });

//     res.status(201).json({
//       message: "Team created successfully",
//       team,
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };


// // ---------------- GET MY TEAM ----------------
// // exports.getMyTeam = async (req, res) => {
// //   try {
// //         console.log("req.user.id:", req.user.id);
// // console.log("type:", typeof req.user.id);
// //     const team = await Team.findOne({ createdBy: req.user.id }).populate("players");
// //     console.log("team found:", team);

// //     if (!team) return res.status(404).json({ message: "Team not found" });
    
// //     res.json(team);
// //   } catch (err) {
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// exports.getMyTeam = async (req, res) => {
//   try {
//     const team = await Team.findOne({
//       admins: req.user.id,
//     }).populate("players");

//     return res.json(team || null);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };


// // ---------------- UPDATE TEAM ----------------
// exports.updateTeam = async (req, res) => {
//   try {
//     const team = await Team.findOne({ admins: req.user.id });
//     if (!team) return res.status(404).json({ message: "Team not found" });

//     const { teamName, description, location, foundedYear } = req.body;

//     if (teamName) team.teamName = teamName;
//     if (description) team.description = description;
//     if (location) team.location = location;
//     if (foundedYear) team.foundedYear = foundedYear;

//     if (req.files?.teamLogo) {
//       team.teamLogoUrl = await uploadImage(req.files.teamLogo[0].buffer, "teams");
//     }

//     if (req.files?.coverImage) {
//       team.coverImageUrl = await uploadImage(req.files.coverImage[0].buffer, "teams");
//     }

//     await team.save();
//     res.json({ message: "Team updated", team });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // ---------------- ADD PLAYER ----------------
// exports.addPlayer = async (req, res) => {
//   try {
//     const team = await Team.findOne({ admins: req.user.id });
//     if (!team) return res.status(404).json({ message: "Team not found" });

//     const { playerId } = req.body;
//     const player = await Player.findById(playerId);

//     if (!player) return res.status(404).json({ message: "Player not found" });
//     if (!player.isFreeAgent) return res.status(400).json({ message: "Player already has a team" });

//     team.players.push(playerId);
//     player.teamId = team._id;
//     player.isFreeAgent = false;

//     await team.save();
//     await player.save();

//     res.json({ message: "Player added", team });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // ---------------- REMOVE PLAYER ----------------
// exports.removePlayer = async (req, res) => {
//   try {
//     const team = await Team.findOne({ admins: req.user.id });
//     if (!team) return res.status(404).json({ message: "Team not found" });

//     const { playerId } = req.body;

//     team.players = team.players.filter((id) => id.toString() !== playerId);

//     const player = await Player.findById(playerId);
//     if (player) {
//       player.teamId = null;
//       player.isFreeAgent = true;
//       await player.save();
//     }

//     await team.save();
//     res.json({ message: "Player removed", team });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // ---------------- PUBLIC GET TEAM ----------------
// exports.getTeam = async (req, res) => {
//   try {
//     const team = await Team.findById(req.params.id).populate("players", "name profileImageUrl position jerseyNumber age footed isFreeAgent");
//     if (!team) return res.status(404).json({ message: "Team not found" });

//     res.json(team);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // ---------------- SEARCH TEAMS ----------------
// exports.searchTeams = async (req, res) => {
//   try {
//     const { q } = req.query;

//     const myTeam = await Team.findOne({ createdBy: req.user.id });

//     const teams = await Team.find({
//       teamName: { $regex: q, $options: "i" },
//       _id: { $ne: myTeam?._id },
//     }).select("teamName teamLogoUrl location");

//     res.json(teams);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // ---------------- GET ALL TEAMS ----------------
// exports.getAllTeams = async (req, res) => {
//   try {
//     const teams = await Team.find()
//       .select("teamName teamLogoUrl location foundedYear")
//       .sort({ createdAt: -1 });

//     res.json(teams);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };



// // ---------------- GET TEAM PLAYERS ----------------
// exports.getTeamPlayers = async (req, res) => {
//   try {
//     const { teamId } = req.params;

//     const team = await Team.findById(teamId).populate({
//       path: "players",
//       select:
//         "name profileImageUrl position jerseyNumber age footed isFreeAgent",
//     });

//     if (!team) {
//       return res.status(404).json({ message: "Team not found" });
//     }

//     res.json({
//       teamId: team._id,
//       teamName: team.teamName,
//       players: team.players,
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // teamController.js
// exports.getMyTournaments = async (req, res) => {
//   try {
//     if (req.user.role !== "team") {
//       return res.status(403).json({ message: "Access denied" });
//     }

//     const team = await Team.findOne({ createdBy: req.user.id });
//     if (!team) {
//       return res.status(404).json({ message: "Team not found" });
//     }

//     const tournaments = await Tournament.find({
//       "teams.team": team._id,
//     })
//       .select("name status startDate endDate teams")
//       .sort({ startDate: -1 });

//     res.json(tournaments);
//   } catch (err) {
//     console.error("getMyTournaments error:", err);
//     res.status(500).json({ message: "Failed to load tournaments" });
//   }
// };


// exports.getJoinedTournaments = async (req, res) => {
//   if (req.user.role !== "team") {
//     return res.status(403).json({ message: "Access denied" });
//   }

//   const team = await Team.findOne({ createdBy: req.user.id });
//   if (!team) {
//     return res.status(404).json({ message: "Team not found" });
//   }

//   const tournaments = await Tournament.find({
//     "teams.team": team._id,
//   })
//     .populate("organiser", "name")
//     .sort({ startDate: 1 });

//   const data = await Promise.all(
//     tournaments.map(async (t) => {
//       const upcomingMatches = await Match.countDocuments({
//         tournamentId: t._id,
//         status: { $in: ["PENDING", "ACCEPTED"] },
//         $or: [{ homeTeam: team._id }, { awayTeam: team._id }],
//       });

//       return {
//         id: t._id,
//         name: t.name,
//         status: t.status,
//         startDate: t.startDate,
//         venue: t.venue,
//         upcomingMatches,
//       };
//     })
//   );

//   res.json(data);
// };


// teamController.js - IMPROVED VERSION
const Team = require("../models/Team");
const Player = require("../models/Player");
const { uploadImage } = require("../utils/uploadImage");
const Tournament = require("../models/Tournament");
const Match = require("../models/Match");

// ---------------- Create TEAM ----------------
exports.createTeam = async (req, res) => {
  try {
    const { teamName, description, location, foundedYear } = req.body;

    // Validation
    if (!teamName || teamName.trim() === "") {
      return res.status(400).json({ message: "Team name is required" });
    }

    // Check if user already has a team
    const existingTeam = await Team.findOne({ createdBy: req.user.id });
    if (existingTeam) {
      return res.status(400).json({ 
        message: "You already have a team. Each user can create only one team." 
      });
    }

    let teamLogoUrl = "";
    let coverImageUrl = "";

    // Upload logo if provided
    if (req.files?.teamLogo?.[0]) {
      try {
        teamLogoUrl = await uploadImage(req.files.teamLogo[0].buffer, "teams");
      } catch (uploadErr) {
        console.error("Logo upload failed:", uploadErr);
        return res.status(500).json({ message: "Failed to upload team logo" });
      }
    }

    // Upload cover if provided
    if (req.files?.coverImage?.[0]) {
      try {
        coverImageUrl = await uploadImage(req.files.coverImage[0].buffer, "teams");
      } catch (uploadErr) {
        console.error("Cover upload failed:", uploadErr);
        return res.status(500).json({ message: "Failed to upload cover image" });
      }
    }

    const team = await Team.create({
      teamName: teamName.trim(),
      description: description?.trim() || "",
      location: location?.trim() || "",
      foundedYear: foundedYear || null,
      teamLogoUrl,
      coverImageUrl,
      createdBy: req.user.id,
      admins: [req.user.id],
    });

    res.status(201).json({
      message: "Team created successfully",
      team,
    });
  } catch (err) {
    console.error("Create team error:", err);
    res.status(500).json({ 
      message: err.message || "Failed to create team" 
    });
  }
};

// ---------------- GET MY TEAM ----------------
exports.getMyTeam = async (req, res) => {
  try {
    // Find team where user is either creator OR admin
    const team = await Team.findOne({
      $or: [
        { createdBy: req.user.id },
        { admins: req.user.id }
      ]
    }).populate({
      path: "players",
      select: "name profileImageUrl position jerseyNumber age footed isFreeAgent"
    });

    // Return null if no team (frontend handles this)
    return res.json(team || null);
  } catch (err) {
    console.error("Get my team error:", err);
    res.status(500).json({ message: "Failed to fetch team" });
  }
};

// ---------------- UPDATE TEAM ----------------
exports.updateTeam = async (req, res) => {
  try {
    // Find team where user is admin
    const team = await Team.findOne({ admins: req.user.id });
    
    if (!team) {
      return res.status(404).json({ message: "Team not found or access denied" });
    }

    const { teamName, description, location, foundedYear } = req.body;

    // Update fields only if provided
    if (teamName !== undefined) {
      if (teamName.trim() === "") {
        return res.status(400).json({ message: "Team name cannot be empty" });
      }
      team.teamName = teamName.trim();
    }
    
    if (description !== undefined) team.description = description.trim();
    if (location !== undefined) team.location = location.trim();
    if (foundedYear !== undefined) {
      const year = parseInt(foundedYear);
      if (isNaN(year) || year < 1800 || year > new Date().getFullYear()) {
        return res.status(400).json({ message: "Invalid founding year" });
      }
      team.foundedYear = year;
    }

    // Upload new logo if provided
    if (req.files?.teamLogo?.[0]) {
      try {
        team.teamLogoUrl = await uploadImage(req.files.teamLogo[0].buffer, "teams");
      } catch (uploadErr) {
        console.error("Logo upload failed:", uploadErr);
        return res.status(500).json({ message: "Failed to upload team logo" });
      }
    }

    // Upload new cover if provided
    if (req.files?.coverImage?.[0]) {
      try {
        team.coverImageUrl = await uploadImage(req.files.coverImage[0].buffer, "teams");
      } catch (uploadErr) {
        console.error("Cover upload failed:", uploadErr);
        return res.status(500).json({ message: "Failed to upload cover image" });
      }
    }

    await team.save();
    
    // Populate players before sending response
    await team.populate({
      path: "players",
      select: "name profileImageUrl position jerseyNumber age footed isFreeAgent"
    });

    res.json({ 
      message: "Team updated successfully", 
      team 
    });
  } catch (err) {
    console.error("Update team error:", err);
    res.status(500).json({ 
      message: err.message || "Failed to update team" 
    });
  }
};

// ---------------- ADD PLAYER ----------------
exports.addPlayer = async (req, res) => {
  try {
    const team = await Team.findOne({ admins: req.user.id });
    if (!team) {
      return res.status(404).json({ message: "Team not found or access denied" });
    }

    const { playerId } = req.body;
    
    if (!playerId) {
      return res.status(400).json({ message: "Player ID is required" });
    }

    const player = await Player.findById(playerId);

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    if (!player.isFreeAgent) {
      return res.status(400).json({ 
        message: "Player is already part of another team" 
      });
    }

    // Check if player already in team
    if (team.players.some(p => p.toString() === playerId)) {
      return res.status(400).json({ message: "Player already in team" });
    }

    team.players.push(playerId);
    player.teamId = team._id;
    player.isFreeAgent = false;

    await team.save();
    await player.save();

    await team.populate({
      path: "players",
      select: "name profileImageUrl position jerseyNumber age footed isFreeAgent"
    });

    res.json({ 
      message: "Player added successfully", 
      team 
    });
  } catch (err) {
    console.error("Add player error:", err);
    res.status(500).json({ 
      message: err.message || "Failed to add player" 
    });
  }
};

// ---------------- REMOVE PLAYER ----------------
exports.removePlayer = async (req, res) => {
  try {
    const team = await Team.findOne({ admins: req.user.id });
    if (!team) {
      return res.status(404).json({ message: "Team not found or access denied" });
    }

    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ message: "Player ID is required" });
    }

    // Check if player is in team
    if (!team.players.some(p => p.toString() === playerId)) {
      return res.status(400).json({ message: "Player not in team" });
    }

    team.players = team.players.filter((id) => id.toString() !== playerId);

    const player = await Player.findById(playerId);
    if (player) {
      player.teamId = null;
      player.isFreeAgent = true;
      await player.save();
    }

    await team.save();
    
    await team.populate({
      path: "players",
      select: "name profileImageUrl position jerseyNumber age footed isFreeAgent"
    });

    res.json({ 
      message: "Player removed successfully", 
      team 
    });
  } catch (err) {
    console.error("Remove player error:", err);
    res.status(500).json({ 
      message: err.message || "Failed to remove player" 
    });
  }
};

// ---------------- PUBLIC GET TEAM ----------------
exports.getTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).populate(
      "players",
      "name profileImageUrl position jerseyNumber age footed isFreeAgent"
    );
    
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    res.json(team);
  } catch (err) {
    console.error("Get team error:", err);
    res.status(500).json({ message: "Failed to fetch team" });
  }
};

// ---------------- SEARCH TEAMS ----------------
exports.searchTeams = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({ message: "Search query is required" });
    }

    const myTeam = await Team.findOne({ 
      $or: [
        { createdBy: req.user.id },
        { admins: req.user.id }
      ]
    });

    const teams = await Team.find({
      teamName: { $regex: q.trim(), $options: "i" },
      _id: { $ne: myTeam?._id }, // Exclude user's own team
    })
      .select("teamName teamLogoUrl location")
      .limit(20);

    res.json(teams);
  } catch (err) {
    console.error("Search teams error:", err);
    res.status(500).json({ message: "Search failed" });
  }
};

// ---------------- GET ALL TEAMS ----------------
exports.getAllTeams = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const teams = await Team.find()
      .select("teamName teamLogoUrl location foundedYear")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Team.countDocuments();

    res.json({
      teams,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("Get all teams error:", err);
    res.status(500).json({ message: "Failed to fetch teams" });
  }
};

// ---------------- GET TEAM PLAYERS ----------------
exports.getTeamPlayers = async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await Team.findById(teamId).populate({
      path: "players",
      select: "name profileImageUrl position jerseyNumber age footed isFreeAgent",
    });

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    res.json({
      teamId: team._id,
      teamName: team.teamName,
      players: team.players,
    });
  } catch (err) {
    console.error("Get team players error:", err);
    res.status(500).json({ message: "Failed to fetch team players" });
  }
};

// ---------------- GET MY TOURNAMENTS ----------------
exports.getMyTournaments = async (req, res) => {
  try {
    if (req.user.role !== "team") {
      return res.status(403).json({ message: "Access denied. Team role required." });
    }

    const team = await Team.findOne({ 
      $or: [
        { createdBy: req.user.id },
        { admins: req.user.id }
      ]
    });

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const tournaments = await Tournament.find({
      "teams.team": team._id,
    })
      .select("name status startDate endDate venue teams")
      .sort({ startDate: -1 });

    res.json(tournaments);
  } catch (err) {
    console.error("getMyTournaments error:", err);
    res.status(500).json({ message: "Failed to load tournaments" });
  }
};

// ---------------- GET JOINED TOURNAMENTS ----------------
exports.getJoinedTournaments = async (req, res) => {
  try {
    if (req.user.role !== "team") {
      return res.status(403).json({ message: "Access denied. Team role required." });
    }

    const team = await Team.findOne({ 
      $or: [
        { createdBy: req.user.id },
        { admins: req.user.id }
      ]
    });

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const tournaments = await Tournament.find({
      "teams.team": team._id,
    })
      .populate("organiser", "name")
      .sort({ startDate: 1 });

    const data = await Promise.all(
      tournaments.map(async (t) => {
        const upcomingMatches = await Match.countDocuments({
          tournamentId: t._id,
          status: { $in: ["PENDING", "ACCEPTED"] },
          $or: [{ homeTeam: team._id }, { awayTeam: team._id }],
        });

        return {
          id: t._id,
          name: t.name,
          status: t.status,
          startDate: t.startDate,
          venue: t.venue,
          organiser: t.organiser?.name,
          upcomingMatches,
        };
      })
    );

    res.json(data);
  } catch (err) {
    console.error("getJoinedTournaments error:", err);
    res.status(500).json({ message: "Failed to load joined tournaments" });
  }
};

module.exports = exports;
