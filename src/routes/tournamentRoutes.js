const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const ctrl = require("../controllers/tournamentController");
const tournamentFixtures = require("../controllers/tournamentFixtures");
const validateObjectId = require("../middleware/validateObjectId");

router.get("/open/search", auth, ctrl.searchOpenTournaments);
router.post("/create", auth, ctrl.createTournament);
router.post("/:id/open", auth, validateObjectId("id"), ctrl.openRegistration);
router.post("/:id/close", auth, validateObjectId("id"), ctrl.closeRegistration);
router.post("/:id/join", auth, validateObjectId("id"), ctrl.joinTournament);
router.get(
  "/:id/teamView",
  auth,
  validateObjectId("id"),
  ctrl.getTournamentForTeam,
);
router.post("/:id/end", auth, validateObjectId("id"), ctrl.endTournament);

router.get(
  "/:id/matches",
  auth,
  validateObjectId("id"),
  ctrl.getTournamentMatches,
);

router.post(
  "/:id/generate-fixtures",
  auth,
  validateObjectId("id"),
  tournamentFixtures.generateFixtures,
);

router.get(
  "/:id/fixtures",
  auth,
  validateObjectId("id"),
  tournamentFixtures.getTournamentFixtures,
);

router.post(
  "/:id/advance-round",
  auth,
  validateObjectId("id"),
  tournamentFixtures.advanceKnockoutRound,
);

router.get(
  "/:id/standings",
  auth,
  validateObjectId("id"),
  tournamentFixtures.getStandings,
);

router.post(
  "/:id/start",
  auth,
  validateObjectId("id"),
  tournamentFixtures.startTournament,
);

router.put(
  "/:id/seeding",
  auth,
  validateObjectId("id"),
  tournamentFixtures.updateSeeding,
);

router.get("/:id", auth, validateObjectId("id"), ctrl.getTournament);

module.exports = router;
