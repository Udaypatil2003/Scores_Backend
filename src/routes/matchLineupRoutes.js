// routes/matchLineupRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  submitLineup,
  getMatchLineups,
} = require("../controllers/MatchLineupController");

router.post("/:id/lineup", auth, submitLineup);
router.get("/:id/lineups", auth, getMatchLineups);

module.exports = router;
