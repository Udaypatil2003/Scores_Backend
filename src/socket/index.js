const { Server } = require("socket.io");
const socketAuth = require("./auth");
const {
  joinTeamRoom,
  leaveTeamRoom,
  joinMatchRoom,
  leaveMatchRoom,
} = require("./rooms");

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Socket auth middleware
  io.use(socketAuth);

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id, socket.user);

    // ---- TEAM ROOM JOIN ----
    socket.on("team:join", ({ teamId }) => {
      joinTeamRoom(socket, teamId);
    });

    socket.on("team:leave", ({ teamId }) => {
      leaveTeamRoom(socket, teamId);
    });

    // ---- MATCH ROOM JOIN ----
    socket.on("match:join", ({ matchId }) => {
      joinMatchRoom(socket, matchId);
    });

    socket.on("match:leave", ({ matchId }) => {
      leaveMatchRoom(socket, matchId);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

module.exports = { initSocket, getIO };
