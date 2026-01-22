const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
require("dotenv").config();

// App init
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// DB connect
connectDB();

// Routes
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const playerRoutes = require("./routes/playerRoutes");
app.use("/api/player", playerRoutes);

// TEAM ROUTES (ADD THIS)
const teamRoutes = require("./routes/teamRoutes");
app.use("/api/team", teamRoutes);

const matchRoutes = require("./routes/matchRoutes");
app.use("/api/match", matchRoutes);

const tournamentRoutes = require("./routes/tournamentRoutes");
app.use("/api/tournament", tournamentRoutes);

const matchLineupRoutes = require("./routes/matchLineupRoutes");
app.use("/api/matchlineup", matchLineupRoutes);

const organiserRoutes = require("./routes/organiserRoutes");
app.use("/api/organiser", organiserRoutes);


// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
