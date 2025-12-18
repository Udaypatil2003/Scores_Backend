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
} = require("../controllers/teamController");

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

// Public endpoints
router.get("/all", getAllTeams);
router.get("/get/:id", getTeam);
router.get("/search", auth ,searchTeams);

module.exports = router;
