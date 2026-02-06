import { useEffect, useRef, useState } from "react";
import SocketManager from "./SocketManager";

/**
 * Hook for managing tournament socket events
 * 
 * Usage:
 * const { tournamentData, isConnected } = useTournamentSocket(tournamentId, {
 *   onStart: (data) => console.log("Tournament started!", data),
 *   onAnnouncement: (data) => console.log("Announcement:", data),
 * });
 */
const useTournamentSocket = (tournamentId, callbacks = {}) => {
  const [tournamentData, setTournamentData] = useState({
    status: null,
    announcements: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Use ref to store latest callbacks to avoid re-registering listeners
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!tournamentId) return;

    // Ensure socket is connected
    const initSocket = async () => {
      try {
       
        setIsConnected(true);
      } catch (err) {
        console.error("Failed to connect socket:", err);
        setError(err.message);
        return;
      }

      // Join tournament room
      SocketManager.joinTournament(tournamentId);

      // Register event listeners
      const handleTournamentJoined = (data) => {
        console.log("✅ Tournament joined:", data);
        if (callbacksRef.current.onJoined) {
          callbacksRef.current.onJoined(data);
        }
      };

      const handleTournamentStart = (data) => {
        console.log("🏆 Tournament started:", data);
        setTournamentData((prev) => ({
          ...prev,
          status: data.status,
        }));
        if (callbacksRef.current.onStart) {
          callbacksRef.current.onStart(data);
        }
      };

      const handleTournamentAnnouncement = (data) => {
        console.log("📢 Tournament announcement:", data);
        setTournamentData((prev) => ({
          ...prev,
          announcements: [...prev.announcements, data],
        }));
        if (callbacksRef.current.onAnnouncement) {
          callbacksRef.current.onAnnouncement(data);
        }
      };

      const handleError = (error) => {
        console.error("❌ Socket error:", error);
        setError(error.message);
        if (callbacksRef.current.onError) {
          callbacksRef.current.onError(error);
        }
      };

      // Register all listeners
      SocketManager.on("tournament:joined", handleTournamentJoined);
      SocketManager.on("tournament:start", handleTournamentStart);
      SocketManager.on("tournament:announcement", handleTournamentAnnouncement);
      SocketManager.on("error", handleError);

      // Cleanup function
      return () => {
        console.log("🧹 Cleaning up tournament socket listeners");

        // Leave tournament room
        SocketManager.leaveTournament(tournamentId);

        // Remove all listeners
        SocketManager.off("tournament:joined", handleTournamentJoined);
        SocketManager.off("tournament:start", handleTournamentStart);
        SocketManager.off("tournament:announcement", handleTournamentAnnouncement);
        SocketManager.off("error", handleError);
      };
    };

    const cleanup = initSocket();

    return () => {
      if (cleanup && typeof cleanup.then === "function") {
        cleanup.then((cleanupFn) => cleanupFn && cleanupFn());
      }
    };
  }, [tournamentId]);

  return {
    tournamentData,
    isConnected,
    error,
    // Expose action methods (only for organisers)
    startTournament: () => SocketManager.startTournament(tournamentId),
    sendAnnouncement: (message) =>
      SocketManager.sendTournamentAnnouncement(tournamentId, message),
  };
};

export default useTournamentSocket;
