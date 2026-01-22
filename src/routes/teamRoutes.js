const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const {
  getMyTeam,
  createTeam,
  updateTeam,
  addPlayer,
  removePlayer,
  getTeam,
  searchTeams,
  getAllTeams,
  getTeamPlayers,
  getMyTournaments,
  getJoinedTournaments
} = require("../controllers/teamController");
const { saveLineup, getLineup } = require("../controllers/teamLineupController");


// Team user functions

router.post("/create", auth, upload.fields([
    { name: "teamLogo", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]), createTeam);

router.get("/my-team", auth, getMyTeam);

router.put(
  "/update",
  auth,
  upload.fields([
    { name: "teamLogo", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  updateTeam
);

router.post("/add-player", auth, addPlayer);
router.post("/remove-player", auth, removePlayer);
router.get("/:teamId/players", getTeamPlayers);

// Team lineup functions
router.post("/lineup", auth, saveLineup);
router.get("/lineup", auth, getLineup);

// Public endpoints
router.get("/all", getAllTeams);
router.get("/get/:id", getTeam);
router.get("/search", auth ,searchTeams);
router.get("/joinedTournaments", auth ,getJoinedTournaments );

router.get("/my-tournaments", auth, getMyTournaments);


module.exports = router;
