const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  createMatch,
  respondToMatch,
  getMyMatches,
  cancelMatch,
  getMatchById,
} = require("../controllers/matchController");

// Team match flow
router.post("/create", auth, createMatch);
router.post("/respond", auth, respondToMatch);
router.post("/cancel", auth, cancelMatch);

router.get("/myMatch", auth, getMyMatches);
router.get("/:id", auth, getMatchById);

module.exports = router;
