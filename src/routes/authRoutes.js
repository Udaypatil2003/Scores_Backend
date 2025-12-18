const express = require("express");
const router = express.Router();
const { signup, login } = require("../controllers/authController");
const auth = require("../middleware/authMiddleware")

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", auth, (req, res) => {
  res.json({
    message: "Token verification successful",
    user: req.user,
  });
});

module.exports = router;
