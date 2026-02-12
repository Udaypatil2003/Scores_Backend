const express = require("express");
const http = require("http");
const cors = require("cors");
const connectDB = require("./config/db");
require("dotenv").config();

const { initializeSocket } = require("./socket/socketServer");


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


app.get("/healthstatus", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

const server = http.createServer(app);
initializeSocket(server);



// Start Server
const PORT = process.env.PORT || 8000;

server.listen(PORT,"0.0.0.0", () => {
  console.log(`🚀 Server + Socket.IO running on port ${PORT}`);
});