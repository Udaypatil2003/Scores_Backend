const Tournament = require("../models/Tournament");
const { canStartTournament } = require("../socket/permissions");

module.exports = (io, socket) => {
  /**
   * JOIN TOURNAMENT ROOM
   * Anyone can join to watch a tournament
   */
  socket.on("tournament:join", async ({ tournamentId }) => {
    try {
      if (!tournamentId) {
        return socket.emit("error", { message: "Tournament ID is required" });
      }

      // Verify tournament exists
      const tournament = await Tournament.findById(tournamentId).select("_id status");

      if (!tournament) {
        return socket.emit("error", { message: "Tournament not found" });
      }

      // Join room
      const roomName = `tournament_${tournamentId}`;
      socket.join(roomName);

      console.log(`🏆 User ${socket.userId} joined room: ${roomName}`);

      // Acknowledge join
      socket.emit("tournament:joined", {
        tournamentId,
        message: "Successfully joined tournament room",
      });

    } catch (error) {
      console.error("Error in tournament:join:", error);
      socket.emit("error", { message: "Failed to join tournament room" });
    }
  });

  /**
   * LEAVE TOURNAMENT ROOM
   */
  socket.on("tournament:leave", ({ tournamentId }) => {
    try {
      if (!tournamentId) {
        return socket.emit("error", { message: "Tournament ID is required" });
      }

      const roomName = `tournament_${tournamentId}`;
      socket.leave(roomName);

      console.log(`👋 User ${socket.userId} left room: ${roomName}`);

      socket.emit("tournament:left", {
        tournamentId,
        message: "Successfully left tournament room",
      });

    } catch (error) {
      console.error("Error in tournament:leave:", error);
      socket.emit("error", { message: "Failed to leave tournament room" });
    }
  });

  /**
   * START TOURNAMENT
   * Only tournament organiser can start
   * Status: FIXTURES_GENERATED → LIVE
   */
  socket.on("tournament:start", async ({ tournamentId }) => {
    try {
      if (!tournamentId) {
        return socket.emit("error", { message: "Tournament ID is required" });
      }

      // Only organisers can start tournaments
      if (socket.userRole !== "organiser") {
        return socket.emit("error", {
          message: "Only organisers can start tournaments",
        });
      }

      if (!socket.organiserId) {
        return socket.emit("error", {
          message: "Organiser ID not found",
        });
      }

      // Check permissions
      const permission = await canStartTournament(tournamentId, socket.organiserId);

      if (!permission.allowed) {
        return socket.emit("error", {
          message: `Cannot start tournament: ${permission.reason}`,
        });
      }

      // Update tournament status to LIVE
      const tournament = await Tournament.findByIdAndUpdate(
        tournamentId,
        { status: "LIVE" },
        { new: true }
      )
        .populate("organiser", "name")
        .populate("teams.team", "teamName teamLogoUrl")
        .lean();

      // Broadcast to all users in the tournament room
      const roomName = `tournament_${tournamentId}`;
      io.to(roomName).emit("tournament:start", {
        tournamentId: tournament._id,
        name: tournament.name,
        status: tournament.status,
        organiser: tournament.organiser,
        teams: tournament.teams,
        message: "Tournament has started",
      });

      console.log(`🏆 Tournament started: ${tournamentId} by ${socket.userId}`);

    } catch (error) {
      console.error("Error in tournament:start:", error);
      socket.emit("error", { message: "Failed to start tournament" });
    }
  });

  /**
   * TOURNAMENT ANNOUNCEMENT
   * Only tournament organiser can broadcast announcements
   */
  socket.on("tournament:announcement", async ({ tournamentId, message }) => {
    try {
      if (!tournamentId || !message) {
        return socket.emit("error", {
          message: "Tournament ID and message are required",
        });
      }

      // Only organisers can make announcements
      if (socket.userRole !== "organiser") {
        return socket.emit("error", {
          message: "Only organisers can make announcements",
        });
      }

      if (!socket.organiserId) {
        return socket.emit("error", {
          message: "Organiser ID not found",
        });
      }

      // Verify organiser owns this tournament
      const permission = await canStartTournament(tournamentId, socket.organiserId);

      if (!permission.allowed) {
        return socket.emit("error", {
          message: `Cannot make announcement: ${permission.reason}`,
        });
      }

      // Broadcast to all users in the tournament room
      const roomName = `tournament_${tournamentId}`;
      io.to(roomName).emit("tournament:announcement", {
        tournamentId,
        message,
        timestamp: new Date(),
      });

      console.log(`📢 Tournament announcement: ${tournamentId}`);

    } catch (error) {
      console.error("Error in tournament:announcement:", error);
      socket.emit("error", { message: "Failed to send announcement" });
    }
  });
};
