const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const {
  saveOrganiserProfile,
  getMyOrganiserProfile,
  checkOrganiserProfile,
  getMyTournaments, 
  getMyMatches
} = require("../controllers/organiserController");

// PROFILE
router.post(
  "/profile",
  auth,
  upload.fields([{ name: "logo", maxCount: 1 }]),
  saveOrganiserProfile
);

router.get("/profile", auth, getMyOrganiserProfile);
router.get("/profile/status", auth, checkOrganiserProfile);

// ✅ MY TOURNAMENTS
router.get("/tournaments", auth, getMyTournaments);
// routes
router.get("/getMatches", auth, getMyMatches);


module.exports = router;
