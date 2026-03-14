const express = require("express");
const router = express.Router();
const DeviceToken = require("../models/DeviceToken");
const auth = require("../middleware/authMiddleware"); // your existing auth middleware

// ✅ Save or update FCM token (called on every login)
router.post("/save-token", auth, async (req, res) => {
     console.log("📥 Save token hit");
  console.log("👤 User from JWT:", req.user);
  console.log("📦 Body received:", req.body);
  const { token, role } = req.body;
  const userId = req.user.id; // from your auth middleware

  try {
    await DeviceToken.findOneAndUpdate(
      { userId },
      { fcmToken: token, role },
      { upsert: true, new: true }
    );
        console.log("✅ Token saved for user:", userId);
    res.json({ success: true, message: "Token saved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Remove token on logout
router.delete("/remove-token", auth, async (req, res) => {
  const userId = req.user.id;
  try {
    await DeviceToken.findOneAndDelete({ userId });
    res.json({ success: true, message: "Token removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
