// routes/matchLineupRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

const {
  submitLineup,
  getMatchLineups,
} = require("../controllers/MatchLineupController");

router.post("/:id/lineup", auth, validateObjectId("id"), submitLineup);
router.get("/:id/lineups", auth, validateObjectId("id"), getMatchLineups);

module.exports = router;
