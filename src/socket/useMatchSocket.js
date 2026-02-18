import { useEffect, useRef, useState } from "react";
import SocketManager from "./SocketManager";

/**
 * Hook for managing match socket events
 *
 * Usage:
 * const { matchData, isConnected } = useMatchSocket(matchId, {
 *   onGoal: (data) => console.log("Goal!", data),
 *   onCard: (data) => console.log("Card!", data),
 * });
 */
const useMatchSocket = (matchId, callbacks = {}) => {
  const [matchData, setMatchData] = useState({
    score: { home: 0, away: 0 },
    status: null,
    events: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Use ref to store latest callbacks to avoid re-registering listeners
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!matchId) return;

    // Ensure socket is connected
    const initSocket = async () => {
      try {
        setIsConnected(true);
      } catch (err) {
        console.error("Failed to connect socket:", err);
        setError(err.message);
        return;
      }

      // Join match room
      SocketManager.joinMatch(matchId);

      // Register event listeners
      const handleMatchJoined = (data) => {
        console.log("✅ Match joined:", data);
        if (callbacksRef.current.onJoined) {
          callbacksRef.current.onJoined(data);
        }
      };

      const handleMatchStart = (data) => {
        console.log("⚽ Match started:", data);
        setMatchData((prev) => ({
          ...prev,
          status: data.status,
          startedAt: data.startedAt,
        }));
        if (callbacksRef.current.onStart) {
          callbacksRef.current.onStart(data);
        }
      };

      const handleMatchEnd = (data) => {
        console.log("🏁 Match ended:", data);
        setMatchData((prev) => ({
          ...prev,
          status: data.status,
          completedAt: data.completedAt,
          winner: data.winner,
        }));
        if (callbacksRef.current.onEnd) {
          callbacksRef.current.onEnd(data);
        }
      };

      const handleGoal = (data) => {
        console.log("⚽ Goal scored:", data);
        setMatchData((prev) => ({
          ...prev,
          score: data.score,
          events: [...prev.events, data.event],
        }));
        if (callbacksRef.current.onGoal) {
          callbacksRef.current.onGoal(data);
        }
      };

      const handleCard = (data) => {
        console.log("🟨 Card issued:", data);
        setMatchData((prev) => ({
          ...prev,
          events: [...prev.events, data.event],
        }));
        if (callbacksRef.current.onCard) {
          callbacksRef.current.onCard(data);
        }
      };

      const handleSubstitution = (data) => {
        console.log("🔄 Substitution made:", data);
        setMatchData((prev) => ({
          ...prev,
          events: [...prev.events, data.event],
        }));
        if (callbacksRef.current.onSubstitution) {
          callbacksRef.current.onSubstitution(data);
        }
      };

      const handleStatusUpdate = (data) => {
        console.log("📊 Match status updated:", data);
        setMatchData((prev) => ({
          ...prev,
          status: data.status,
        }));
        if (callbacksRef.current.onStatusUpdate) {
          callbacksRef.current.onStatusUpdate(data);
        }
      };

      const handleError = (error) => {
        console.error("❌ Socket error:", error);
        setError(error.message);
        if (callbacksRef.current.onError) {
          callbacksRef.current.onError(error);
        }
      };

      // Add this handler with the other handlers
      const handleMatchReset = (data) => {
        console.log("🔄 Match reset:", data);
        setMatchData((prev) => ({
          ...prev,
          score: data.score,
          status: data.status,
          events: [],
          startedAt: null,
          completedAt: null,
          winner: null,
        }));
        if (callbacksRef.current.onReset) {
          callbacksRef.current.onReset(data);
        }
      };

      // Register the listener (add this with other SocketManager.on calls)
      SocketManager.on("match:reset", handleMatchReset);
      // Register all listeners
      SocketManager.on("match:joined", handleMatchJoined);
      SocketManager.on("match:start", handleMatchStart);
      SocketManager.on("match:end", handleMatchEnd);
      SocketManager.on("match:goal", handleGoal);
      SocketManager.on("match:card", handleCard);
      SocketManager.on("match:substitution", handleSubstitution);
      SocketManager.on("match:status", handleStatusUpdate);
      SocketManager.on("error", handleError);

      // Cleanup function
      return () => {
        console.log("🧹 Cleaning up match socket listeners");

        // Leave match room
        SocketManager.leaveMatch(matchId);

        // Remove all listeners
        SocketManager.off("match:joined", handleMatchJoined);
        SocketManager.off("match:start", handleMatchStart);
        SocketManager.off("match:end", handleMatchEnd);
        SocketManager.off("match:goal", handleGoal);
        SocketManager.off("match:card", handleCard);
        SocketManager.off("match:substitution", handleSubstitution);
        SocketManager.off("match:status", handleStatusUpdate);
        SocketManager.off("error", handleError);
      };
    };

    const cleanup = initSocket();

    return () => {
      if (cleanup && typeof cleanup.then === "function") {
        cleanup.then((cleanupFn) => cleanupFn && cleanupFn());
      }
    };
  }, [matchId]);

  return {
    matchData,
    isConnected,
    error,
    // Expose action methods
    startMatch: () => SocketManager.startMatch(matchId),
    endMatch: () => SocketManager.endMatch(matchId),
    addGoal: (teamId, playerId, minute, assistPlayerId, type) =>
      SocketManager.addGoal(
        matchId,
        teamId,
        playerId,
        minute,
        assistPlayerId,
        type,
      ),
    addCard: (teamId, playerId, minute, type) =>
      SocketManager.addCard(matchId, teamId, playerId, minute, type),
    addSubstitution: (teamId, playerOutId, playerInId, minute) =>
      SocketManager.addSubstitution(
        matchId,
        teamId,
        playerOutId,
        playerInId,
        minute,
      ),
  };
};

export default useMatchSocket;
