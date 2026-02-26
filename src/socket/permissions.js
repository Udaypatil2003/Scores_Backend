const Match = require("../models/Match");
const Tournament = require("../models/Tournament");

/**
 * Check if user can update a specific match
 *
 * RULES:
 * - Organiser can update ONLY tournament matches they own
 * - Team can update ONLY matches they created (createdBy = their userId)
 * - Players CANNOT update any match
 *
 * @param {String} matchId - Match ID
 * @param {String} userId - User ID from socket
 * @param {String} userRole - "player" | "team" | "organiser"
 * @param {String} teamId - Team ID (if role is "team")
 * @param {String} organiserId - Organiser ID (if role is "organiser")
 * @returns {Object} { allowed: Boolean, reason: String, match: Object }
 */

// function canUserControlMatch(socket, match, purpose) {
//   // purpose: "START" | "UPDATE"

//   if (socket.userRole === "player") {
//     return { allowed: false, reason: "Players cannot control matches" };
//   }

//   // START vs UPDATE status checks
//   if (purpose === "START" && match.status !== "ACCEPTED") {
//     return { allowed: false, reason: "Match must be accepted before starting" };
//   }

//   if (purpose === "UPDATE" && match.status !== "LIVE") {
//     return { allowed: false, reason: "Match is not live" };
//   }

//   // TOURNAMENT MATCH
//   if (match.tournamentId) {
//     if (socket.userRole !== "organiser" || !socket.organiserId) {
//       return {
//         allowed: false,
//         reason: "Only organiser can control tournament match",
//       };
//     }
//     return { allowed: true, reason: "Tournament organiser" };
//   }

//   // FRIENDLY MATCH
//   if (socket.userRole === "team" && socket.teamId) {
//     if (match.createdBy.toString() === socket.teamId) {
//       return { allowed: true, reason: "Match creator team" };
//     }
//   }

//   return { allowed: false, reason: "You do not control this match " };
// }

const canUpdateMatch = async (
  matchId,
  userId,
  userRole,
  teamId = null,
  organiserId = null,
  targetStatus = null,
) => {
  try {
    // Fetch match with necessary fields
    const match = await Match.findById(matchId)
      .select(
        "createdBy createdByRole status matchType tournamentId homeTeam awayTeam score winner",
      )
      .lean();

    if (!match) {
      return { allowed: false, reason: "Match not found", match: null };
    }

    // ✅ Allow same-status updates (idempotent)
    if (targetStatus && match.status === targetStatus) {
      return {
        allowed: true,
        reason: "Status unchanged (idempotent)",
        match,
      };
    }

    // ✅ Define valid status transitions
    const validTransitions = {
      ACCEPTED: ["LIVE"], // Can only start
      LIVE: ["PAUSED", "COMPLETED"], // Can pause or end
      PAUSED: ["LIVE", "COMPLETED"], // Can resume or end
    };

    // Check if current status allows updates
    if (!validTransitions[match.status]) {
      return {
        allowed: false,
        reason: `Cannot update match with status: ${match.status}`,
        match,
      };
    }

    // ✅ If targetStatus is provided, validate the transition
    if (
      targetStatus &&
      !validTransitions[match.status].includes(targetStatus)
    ) {
      return {
        allowed: false,
        reason: `Cannot change from ${match.status} to ${targetStatus}`,
        match,
      };
    }
    // Special case: RESET
    if (targetStatus === "RESET") {
      if (!["LIVE", "PAUSED", "COMPLETED"].includes(match.status)) {
        return {
          allowed: false,
          reason: "Match cannot be reset from current state",
          match,
        };
      }
    }

    // PLAYER role → ALWAYS DENIED
    if (userRole === "player") {
      return { allowed: false, reason: "Players cannot update matches", match };
    }

    // TEAM role → Can ONLY update matches they created
    if (userRole === "team") {
      if (!teamId) {
        return { allowed: false, reason: "Team ID not found", match };
      }

      // Check if this team created the match
      if (
        match.createdBy.toString() === userId &&
        match.createdByRole === "team"
      ) {
        return { allowed: true, reason: "Team owner", match };
      }

      return { allowed: false, reason: "You are not the match owner", match };
    }

    // ORGANISER role → Can ONLY update tournament matches they own

    if (userRole === "organiser") {
      if (!organiserId) {
        return { allowed: false, reason: "Organiser ID not found", match };
      }

      if (match.matchType !== "Tournament" || !match.tournamentId) {
        return { allowed: false, reason: "Not a tournament match", match };
      }

      const tournament = await Tournament.findById(match.tournamentId)
        .select("organiser")
        .lean();

      if (!tournament) {
        return { allowed: false, reason: "Tournament not found", match };
      }

      // ✅ Single clean check — migration fixed all old data
      if (tournament.organiser.toString() === organiserId) {
        return { allowed: true, reason: "Tournament organiser", match };
      }

      return {
        allowed: false,
        reason: "You do not own this tournament",
        match,
      };
    }

    return { allowed: false, reason: "Invalid role", match };
  } catch (error) {
    console.error("Error in canUpdateMatch:", error);
    return { allowed: false, reason: "Server error", match: null };
  }
};

/**
 * Check if user can start a match
 * Same logic as canUpdateMatch but checks if status is ACCEPTED (ready to start)
 */
const canStartMatch = async (
  matchId,
  userId,
  userRole,
  teamId = null,
  organiserId = null,
) => {
  try {
    const match = await Match.findById(matchId)
      .select("createdBy createdByRole status matchType tournamentId")
      .lean();

    if (!match) {
      return { allowed: false, reason: "Match not found", match: null };
    }

    // Match must be ACCEPTED to be started
   if (!["ACCEPTED", "LIVE"].includes(match.status)) {
  return {
    allowed: false,
    reason: "Match cannot be started from current status",
    match,
  };
}

    // Apply same ownership rules
    if (userRole === "player") {
      return { allowed: false, reason: "Players cannot start matches", match };
    }

    if (userRole === "team") {
      if (!teamId) {
        return { allowed: false, reason: "Team ID not found", match };
      }

      if (
        match.createdBy.toString() === userId &&
        match.createdByRole === "team"
      ) {
        return { allowed: true, reason: "Team owner", match };
      }

      return { allowed: false, reason: "You are not the match owner", match };
    }

    if (userRole === "organiser") {
      if (!organiserId) {
        return { allowed: false, reason: "Organiser ID not found", match };
      }

      if (match.matchType !== "Tournament" || !match.tournamentId) {
        return { allowed: false, reason: "Not a tournament match", match };
      }

      const tournament = await Tournament.findById(match.tournamentId)
        .select("organiser")
        .lean();

      if (!tournament) {
        return { allowed: false, reason: "Tournament not found", match };
      }

      // ✅ Single clean check
      if (tournament.organiser.toString() === organiserId) {
        return { allowed: true, reason: "Tournament organiser", match };
      }

      return {
        allowed: false,
        reason: "You do not own this tournament",
        match,
      };
    }

    return { allowed: false, reason: "Invalid role", match };
  } catch (error) {
    console.error("Error in canStartMatch:", error);
    return { allowed: false, reason: "Server error", match: null };
  }
};

/**
 * Check if user can start a tournament
 */
const canStartTournament = async (tournamentId, organiserId) => {
  try {
    const tournament = await Tournament.findById(tournamentId)
      .select("organiser status")
      .lean();

    if (!tournament) {
      return { allowed: false, reason: "Tournament not found" };
    }

    // ✅ Single clean check
    if (tournament.organiser.toString() !== organiserId) {
      return { allowed: false, reason: "You are not the tournament organiser" };
    }

    if (["LIVE", "COMPLETED"].includes(tournament.status)) {
      return {
        allowed: false,
        reason: "Tournament already started or completed",
      };
    }

    return { allowed: true, reason: "Tournament owner" };
  } catch (error) {
    console.error("Error in canStartTournament:", error);
    return { allowed: false, reason: "Server error" };
  }
};

module.exports = {
  canUpdateMatch,
  canStartMatch,
  canStartTournament,
};
