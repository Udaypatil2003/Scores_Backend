// routes/stats.routes.js
const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statsController");
const auth = require("../middleware/authMiddleware");

// Tournament-level stats (standings, top scorers, overview)
router.get("/tournament/:tournamentId/stats", auth, statsController.getTournamentStats);

// Team stats within a tournament (or overall if no tournamentId)
router.get("/team/:teamId/stats", auth, statsController.getTeamStats);

// Player stats within a tournament (or overall if no tournamentId)
router.get("/player/:playerId/stats", auth, statsController.getPlayerStats);

module.exports = router;
