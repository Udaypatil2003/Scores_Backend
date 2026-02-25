const express = require("express");
const router = express.Router();
const { signup, login } = require("../controllers/authController");
const auth = require("../middleware/authMiddleware")
const { authLimiter, apiLimiter} = require("../middleware/rateLimiter");

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.get("/me", auth, (req, res) => {
  res.json({
    message: "Token verification successful",
    user: req.user,
  });
});

module.exports = router;
