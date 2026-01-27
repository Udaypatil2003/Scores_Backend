const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ================= SIGNUP =================
exports.signup = async (req, res) => {
  try {
    const { name, mobile, password, role , email } = req.body;

    // Check if user exists
    const exists = await User.findOne({ mobile });
    if (exists) return res.status(400).json({ message: "Mobile already registered" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      mobile,
      email,
      password: hashedPassword,
      role,
    });

    res.status(201).json({ message: "User created", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= LOGIN =================
// authController.js - Your current code is GOOD!
exports.login = async (req, res) => {
  try {
    const { mobile, password } = req.body;
    const user = await User.findOne({ mobile });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,  // ✅ This is already here - perfect!
        mobile: user.mobile,
        role: user.role,
        email: user.email || "",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login Successful",
      token,
      user,  // ✅ You're already sending user - perfect!
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

