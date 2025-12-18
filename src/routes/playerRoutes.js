const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { 
  createProfile, 
  updateProfile,
  searchPlayers, 
  getPlayerDetails 
} = require("../controllers/playerController");

// Player creates profile
router.post("/create-profile", auth, upload.single("profileImage"), createProfile);

// Player updates profile
router.post("/update-profile", auth, upload.single("profileImage"), updateProfile);

// Search players
router.get("/search", searchPlayers);

// Get profile (pre-filled info)
router.get("/me", auth, getPlayerDetails);

module.exports = router;
