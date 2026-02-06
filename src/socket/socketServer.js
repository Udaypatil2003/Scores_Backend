const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Team = require("../models/Team");
const Organiser = require("../models/Organiser");

const matchHandlers = require("../handlers/matchHandlers");
const tournamentHandlers = require("../handlers/tournamentHandlers");

let io;

/**
 * Initialize Socket.IO server
 * @param {Object} server - HTTP server instance
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://192.168.0.140:8081", // Metro (optional)
        "http://192.168.0.140:5000", // Socket itself (safe)
        "http://192.168.0.140:8000", // API origin if needed
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"], // IMPORTANT
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      // Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch user details
      const user = await User.findById(decoded.id).select("-password");
      console.log("🧪 Socket JWT decoded payload:", decoded);

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      // Attach user data to socket
      socket.userId = user._id.toString();
      socket.userRole = user.role; // "player" | "team" | "organiser"

      // If role is "team", fetch teamId
      if (user.role === "team") {
        const team = await Team.findOne({ createdBy: user._id });
        if (team) {
          socket.teamId = team._id.toString();
        }
      }

      // If role is "organiser", fetch organiserId
      if (user.role === "organiser") {
        const organiser = await Organiser.findOne({ user: user._id });
        if (organiser) {
          socket.organiserId = organiser._id.toString();
        }
      }

      console.log(`✅ Socket authenticated: ${socket.id} | User: ${socket.userId} | Role: ${socket.userRole}`);

      next();
    } catch (error) {
      console.error("Socket auth error:", error.message);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // Connection Handler
  io.on("connection", (socket) => {
    console.log(`🔌 New socket connection: ${socket.id}`);

    // Register Match Handlers
    matchHandlers(io, socket);

    // Register Tournament Handlers
    tournamentHandlers(io, socket);

    // Disconnection
    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id} | Reason: ${reason}`);
    });
  });

  console.log("🚀 Socket.IO server initialized");

  return io;
};

/**
 * Get Socket.IO instance
 * @returns {Server} Socket.IO server instance
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeSocket() first.");
  }
  return io;
};

module.exports = { initializeSocket, getIO };
