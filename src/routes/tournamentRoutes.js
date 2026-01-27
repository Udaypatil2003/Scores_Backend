const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const ctrl = require("../controllers/tournamentController");
const tournamentFixtures = require("../controllers/tournamentFixtures");



router.get("/open/search", auth, ctrl.searchOpenTournaments);
router.post("/create", auth, ctrl.createTournament);
router.post("/:id/open", auth, ctrl.openRegistration);
router.post("/:id/close", auth, ctrl.closeRegistration);
router.post("/:id/join", auth, ctrl.joinTournament);
router.get("/:id/teamView", auth, ctrl.getTournamentForTeam);
router.post("/:id/end", auth, ctrl.endTournament);



// KEEP THIS LAST
router.get("/:id", auth, ctrl.getTournament);
router.get(
  "/:id/matches",
  auth,
  ctrl.getTournamentMatches
);

router.post(
  "/:id/generate-fixtures",
  auth,
  tournamentFixtures.generateFixtures
);

router.get(
  "/:id/fixtures",
  auth,
  tournamentFixtures.getTournamentFixtures
);

router.post(
  "/:id/advance-round",
  auth,
  tournamentFixtures.advanceKnockoutRound
);

router.get(
  "/:id/standings",
  auth,
  tournamentFixtures.getStandings
);

router.post(
  "/:id/start",
  auth,
  tournamentFixtures.startTournament
);

router.put(
  "/:id/seeding",
  auth,
  tournamentFixtures.updateSeeding
);

module.exports = router;
