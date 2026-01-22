const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const ctrl = require("../controllers/tournamentController");



router.get("/open/search", auth, ctrl.searchOpenTournaments);
router.post("/create", auth, ctrl.createTournament);
router.post("/:id/open", auth, ctrl.openRegistration);
router.post("/:id/close", auth, ctrl.closeRegistration);
router.post("/:id/join", auth, ctrl.joinTournament);
router.post("/:id/fixtures", auth, ctrl.generateFixtures);

router.get("/:id/teamView", auth, ctrl.getTournamentForTeam);



// KEEP THIS LAST
router.get("/:id", auth, ctrl.getTournament);

module.exports = router;
