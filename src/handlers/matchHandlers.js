const Match = require("../models/Match");
const { canUpdateMatch, canStartMatch } = require("../socket/permissions");

module.exports = (io, socket) => {
  /**
   * JOIN MATCH ROOM
   * Anyone can join to watch a match
   */
  socket.on("match:join", async ({ matchId }) => {
    try {
      if (!matchId) {
        return socket.emit("error", { message: "Match ID is required" });
      }

      // Verify match exists
      const match = await Match.findById(matchId).select("_id status");

      if (!match) {
        return socket.emit("error", { message: "Match not found" });
      }

      // Join room
      const roomName = `match_${matchId}`;
      socket.join(roomName);

      console.log(`👁️ User ${socket.userId} joined room: ${roomName}`);

      // Acknowledge join
      socket.emit("match:joined", {
        matchId,
        message: "Successfully joined match room",
      });
    } catch (error) {
      console.error("Error in match:join:", error);
      socket.emit("error", { message: "Failed to join match room" });
    }
  });

  /**
   * LEAVE MATCH ROOM
   */
  socket.on("match:leave", ({ matchId }) => {
    try {
      if (!matchId) {
        return socket.emit("error", { message: "Match ID is required" });
      }

      const roomName = `match_${matchId}`;
      socket.leave(roomName);

      console.log(`👋 User ${socket.userId} left room: ${roomName}`);

      socket.emit("match:left", {
        matchId,
        message: "Successfully left match room",
      });
    } catch (error) {
      console.error("Error in match:leave:", error);
      socket.emit("error", { message: "Failed to leave match room" });
    }
  });

  /**
   * START MATCH
   * Only match owner can start
   * Status: ACCEPTED → LIVE
   */
  socket.on("match:start", async ({ matchId }) => {
    try {
      if (!matchId) {
        return socket.emit("error", { message: "Match ID is required" });
      }

      // Check permissions
      const permission = await canStartMatch(
        matchId,
        socket.userId,
        socket.userRole,
        socket.teamId,
        socket.organiserId,
      );

      if (!permission.allowed) {
        return socket.emit("error", {
          message: `Cannot start match: ${permission.reason}`,
        });
      }

      // Update match status to LIVE
      const match = await Match.findByIdAndUpdate(
        matchId,
        {
          status: "LIVE",
          startedAt: new Date(),
        },
        { new: true },
      )
        .populate("homeTeam", "teamName teamLogoUrl")
        .populate("awayTeam", "teamName teamLogoUrl")
        .lean();

      // Broadcast to all users in the match room
      const roomName = `match_${matchId}`;
      io.to(roomName).emit("match:start", {
        matchId: match._id,
        status: match.status,
        startedAt: match.startedAt,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        message: "Match has started",
      });

      console.log(`⚽ Match started: ${matchId} by ${socket.userId}`);
    } catch (error) {
      console.error("Error in match:start:", error);
      socket.emit("error", { message: "Failed to start match" });
    }
  });

  /**
   * END MATCH
   * Only match owner can end
   * Status: LIVE → COMPLETED
   */
  socket.on("match:end", async ({ matchId }) => {
    try {
      if (!matchId) {
        return socket.emit("error", { message: "Match ID is required" });
      }

      // Check permissions
      const permission = await canUpdateMatch(
        matchId,
        socket.userId,
        socket.userRole,
        socket.teamId,
        socket.organiserId,
        "RESET", // 👈 pass special type
      );

      if (!permission.allowed) {
        return socket.emit("error", {
          message: `Cannot end match: ${permission.reason}`,
        });
      }

      // Determine winner based on score
      const match = permission.match;
      let winner = null;

      if (match.score.home > match.score.away) {
        winner = match.homeTeam;
      } else if (match.score.away > match.score.home) {
        winner = match.awayTeam;
      }

      // Update match status to COMPLETED
      const updatedMatch = await Match.findByIdAndUpdate(
        matchId,
        {
          score: { home: 0, away: 0 },
          events: [],
          status: "ACCEPTED",
          startedAt: null,
          completedAt: null,
          winner: null,
        },
        { new: true },
      )
        .populate("homeTeam", "teamName teamLogoUrl")
        .populate("awayTeam", "teamName teamLogoUrl")
        .populate("winner", "teamName teamLogoUrl")
        .lean();

      // Broadcast to all users in the match room
      const roomName = `match_${matchId}`;
      io.to(roomName).emit("match:end", {
        matchId: updatedMatch._id,
        status: updatedMatch.status,
        completedAt: updatedMatch.completedAt,
        finalScore: updatedMatch.score,
        winner: updatedMatch.winner,
        message: "Match has ended",
      });

      console.log(`🏁 Match ended: ${matchId}`);
    } catch (error) {
      console.error("Error in match:end:", error);
      socket.emit("error", { message: "Failed to end match" });
    }
  });

  /**
   * ADD GOAL EVENT
   * Only match owner can add goal
   */
  socket.on("match:goal", async (payload) => {
    try {
      const { matchId, teamId, playerId, assistPlayerId, minute, type } =
        payload;

      if (!matchId || !teamId || !playerId || minute == null) {
        return socket.emit("error", { message: "Missing required fields" });
      }

      // Check permissions
      const permission = await canUpdateMatch(
        matchId,
        socket.userId,
        socket.userRole,
        socket.teamId,
        socket.organiserId,
      );

      if (!permission.allowed) {
        return socket.emit("error", {
          message: `Cannot add goal: ${permission.reason}`,
        });
      }

      // Create goal event
      const goalEvent = {
        type: type || "GOAL", // GOAL | PENALTY_GOAL | OWN_GOAL
        team: teamId,
        player: playerId,
        assistPlayer: assistPlayerId || null,
        minute: minute,
      };

      // Determine which team scored
      const match = permission.match;
      const isHomeTeam = match.homeTeam.toString() === teamId;

      // Update score and add event
      const updateQuery = {
        $push: { events: goalEvent },
        $inc: isHomeTeam ? { "score.home": 1 } : { "score.away": 1 },
      };

      const updatedMatch = await Match.findByIdAndUpdate(matchId, updateQuery, {
        new: true,
      })
        .populate("events.player", "playerName")
        .populate("events.assistPlayer", "playerName")
        .populate("homeTeam", "teamName")
        .populate("awayTeam", "teamName")
        .lean();

      // Get the newly added event
      const newEvent = updatedMatch.events[updatedMatch.events.length - 1];

      // Broadcast to all users in the match room
      const roomName = `match_${matchId}`;
      io.to(roomName).emit("match:goal", {
        matchId: updatedMatch._id,
        event: newEvent,
        score: updatedMatch.score,
        homeTeam: updatedMatch.homeTeam,
        awayTeam: updatedMatch.awayTeam,
      });

      console.log(`⚽ Goal added to match ${matchId} by ${socket.userId}`);
    } catch (error) {
      console.error("Error in match:goal:", error);
      socket.emit("error", { message: "Failed to add goal" });
    }
  });

  /**
   * ADD CARD EVENT (YELLOW or RED)
   * Only match owner can add card
   */
  socket.on("match:card", async (payload) => {
    try {
      const { matchId, teamId, playerId, minute, type } = payload;

      if (!matchId || !teamId || !playerId || minute == null || !type) {
        return socket.emit("error", { message: "Missing required fields" });
      }

      if (!["YELLOW", "RED"].includes(type)) {
        return socket.emit("error", {
          message: "Card type must be YELLOW or RED",
        });
      }

      // Check permissions
      const permission = await canUpdateMatch(
        matchId,
        socket.userId,
        socket.userRole,
        socket.teamId,
        socket.organiserId,
      );

      if (!permission.allowed) {
        return socket.emit("error", {
          message: `Cannot add card: ${permission.reason}`,
        });
      }

      // Create card event
      const cardEvent = {
        type: type,
        team: teamId,
        player: playerId,
        minute: minute,
      };

      // Update match
      const updatedMatch = await Match.findByIdAndUpdate(
        matchId,
        { $push: { events: cardEvent } },
        { new: true },
      )
        .populate("events.player", "playerName")
        .populate("homeTeam", "teamName")
        .populate("awayTeam", "teamName")
        .lean();

      // Get the newly added event
      const newEvent = updatedMatch.events[updatedMatch.events.length - 1];

      // Broadcast to all users in the match room
      const roomName = `match_${matchId}`;
      io.to(roomName).emit("match:card", {
        matchId: updatedMatch._id,
        event: newEvent,
        homeTeam: updatedMatch.homeTeam,
        awayTeam: updatedMatch.awayTeam,
      });

      console.log(
        `🟨 ${type} card added to match ${matchId} by ${socket.userId}`,
      );
    } catch (error) {
      console.error("Error in match:card:", error);
      socket.emit("error", { message: "Failed to add card" });
    }
  });

  /**
   * ADD SUBSTITUTION EVENT
   * Only match owner can add substitution
   */
  socket.on("match:substitution", async (payload) => {
    try {
      const { matchId, teamId, playerOutId, playerInId, minute } = payload;

      if (
        !matchId ||
        !teamId ||
        !playerOutId ||
        !playerInId ||
        minute == null
      ) {
        return socket.emit("error", { message: "Missing required fields" });
      }

      // Check permissions
      const permission = await canUpdateMatch(
        matchId,
        socket.userId,
        socket.userRole,
        socket.teamId,
        socket.organiserId,
      );

      if (!permission.allowed) {
        return socket.emit("error", {
          message: `Cannot add substitution: ${permission.reason}`,
        });
      }

      // Create substitution event
      const subEvent = {
        type: "SUBSTITUTION",
        team: teamId,
        player: playerInId, // Player coming in
        substitutedPlayer: playerOutId, // Player going out
        minute: minute,
      };

      // Update match
      const updatedMatch = await Match.findByIdAndUpdate(
        matchId,
        { $push: { events: subEvent } },
        { new: true },
      )
        .populate("events.player", "playerName")
        .populate("events.substitutedPlayer", "playerName")
        .populate("homeTeam", "teamName")
        .populate("awayTeam", "teamName")
        .lean();

      // Get the newly added event
      const newEvent = updatedMatch.events[updatedMatch.events.length - 1];

      // Broadcast to all users in the match room
      const roomName = `match_${matchId}`;
      io.to(roomName).emit("match:substitution", {
        matchId: updatedMatch._id,
        event: newEvent,
        homeTeam: updatedMatch.homeTeam,
        awayTeam: updatedMatch.awayTeam,
      });

      console.log(
        `🔄 Substitution added to match ${matchId} by ${socket.userId}`,
      );
    } catch (error) {
      console.error("Error in match:substitution:", error);
      socket.emit("error", { message: "Failed to add substitution" });
    }
  });

  /**
   * UPDATE MATCH STATUS
   * Only match owner can update status
   * This is a generic status update (for any custom status changes)
   */
  socket.on("match:status", async ({ matchId, status }) => {
    try {
      if (!matchId || !status) {
        return socket.emit("error", {
          message: "Match ID and status are required",
        });
      }

      const validStatuses = [
        "DRAFT",
        "PENDING",
        "ACCEPTED",
        "LIVE",
        "PAUSED",
        "REJECTED",
        "CANCELLED",
        "COMPLETED",
      ];
      if (!validStatuses.includes(status)) {
        return socket.emit("error", { message: "Invalid status" });
      }

      // ✅ Pass targetStatus for validation
      const permission = await canUpdateMatch(
        matchId,
        socket.userId,
        socket.userRole,
        socket.teamId,
        socket.organiserId,
        status, // Target status
      );

      if (!permission.allowed) {
        return socket.emit("error", {
          message: `Cannot update status: ${permission.reason}`,
        });
      }

      // Update match status
      const updatedMatch = await Match.findByIdAndUpdate(
        matchId,
        { status: status },
        { new: true },
      )
        .populate("homeTeam", "teamName")
        .populate("awayTeam", "teamName")
        .lean();

      // Broadcast to all users in the match room
      const roomName = `match_${matchId}`;
      io.to(roomName).emit("match:status", {
        matchId: updatedMatch._id,
        status: updatedMatch.status,
        homeTeam: updatedMatch.homeTeam,
        awayTeam: updatedMatch.awayTeam,
      });

      console.log(`📊 Match status updated: ${matchId} → ${status}`);
    } catch (error) {
      console.error("Error in match:status:", error);
      socket.emit("error", { message: "Failed to update match status" });
    }
  });

  /**
   * RESET MATCH
   * Only match owner can reset
   * Resets score, events, and timer back to starting state
   */
  socket.on("match:reset", async ({ matchId }) => {
    try {
      if (!matchId) {
        return socket.emit("error", { message: "Match ID is required" });
      }

      const permission = await canUpdateMatch(
        matchId,
        socket.userId,
        socket.userRole,
        socket.teamId,
        socket.organiserId,
      );

      if (!permission.allowed) {
        return socket.emit("error", {
          message: `Cannot reset match: ${permission.reason}`,
        });
      }

      // ✅ Make sure events is set to empty array
      const updatedMatch = await Match.findByIdAndUpdate(
        matchId,
        {
          score: { home: 0, away: 0 },
          events: [], // ✅ Explicitly empty array
          startedAt: new Date(),
          status: "LIVE",
        },
        { new: true },
      )
        .populate("homeTeam", "teamName teamLogoUrl")
        .populate("awayTeam", "teamName teamLogoUrl")
        .lean();

      // ✅ Make sure broadcast includes empty events array
      const roomName = `match_${matchId}`;
      io.to(roomName).emit("match:reset", {
        matchId: updatedMatch._id,
        score: updatedMatch.score, // Should be {home: 0, away: 0}
        events: updatedMatch.events || [], // Should be []
        startedAt: updatedMatch.startedAt,
        status: updatedMatch.status,
        homeTeam: updatedMatch.homeTeam,
        awayTeam: updatedMatch.awayTeam,
        message: "Match has been reset",
      });

      console.log(`🔄 Match reset: ${matchId} by ${socket.userId}`);
      console.log(`✅ Reset data:`, {
        score: updatedMatch.score,
        events: updatedMatch.events,
        eventsLength: updatedMatch.events?.length,
      });
    } catch (error) {
      console.error("Error in match:reset:", error);
      socket.emit("error", { message: "Failed to reset match" });
    }
  });
};
