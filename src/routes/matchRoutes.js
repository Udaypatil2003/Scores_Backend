const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");


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
  getMatchesByTournament
} = require("../controllers/matchController");

// Team match flow
router.post("/create", auth, createMatch);
router.post("/respond", auth, respondToMatch);
router.post("/cancel", auth, cancelMatch);

router.post("/start", auth, startMatch);
router.post("/:id/reset", auth, resetMatch);
router.post("/:id/event", auth, addMatchEvent);
router.get("/:id/lineups", auth, getMatchLineups);
router.get("/:id/summary", auth, getMatchSummary);

router.get(
  "/byTournament/:id",
  auth,
  getMatchesByTournament
);




router.post("/end", auth, endMatch);

router.get("/myMatch", auth, getMyMatches);
router.get("/:id", auth, getMatchById);

module.exports = router;
