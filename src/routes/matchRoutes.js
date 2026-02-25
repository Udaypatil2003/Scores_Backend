const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

const {
  createMatch,
  respondToMatch,
  getMyMatches,
  cancelMatch,
  getMatchById,
  startMatch,
  endMatch,
  resetMatch,
  addMatchEvent,
  getMatchLineups,
  getMatchSummary,
  getMatchesByTournament,
} = require("../controllers/matchController");

// Team match flow
router.post("/create", auth, createMatch);
router.post("/respond", auth, respondToMatch);
router.post("/cancel", auth, cancelMatch);

router.post("/start", auth, startMatch);
router.post("/:id/reset", auth, validateObjectId("id"), resetMatch);
router.post("/:id/event", auth, validateObjectId("id"), addMatchEvent);
router.get("/:id/lineups", auth, validateObjectId("id"), getMatchLineups);
router.get("/:id/summary", auth, validateObjectId("id"), getMatchSummary);

router.get(
  "/byTournament/:id",
  auth,
  validateObjectId("id"),
  getMatchesByTournament,
);

router.post("/end", auth, endMatch);

router.get("/myMatch", auth, getMyMatches);
router.get("/:id", auth, validateObjectId("id"), getMatchById);

module.exports = router;
