import { useEffect, useRef, useState } from "react";
import SocketManager from "./SocketManager";

const useTournamentSocket = (tournamentId, callbacks = {}) => {
  const [tournamentData, setTournamentData] = useState({
    status: null,
    announcements: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!tournamentId) return;

    SocketManager.joinTournament(tournamentId);
    setIsConnected(true);

    // ---- Define handlers ----
    const handleTournamentJoined = (data) => {
      callbacksRef.current.onJoined?.(data);
    };

    const handleTournamentStart = (data) => {
      setTournamentData((prev) => ({ ...prev, status: data.status }));
      callbacksRef.current.onStart?.(data);
    };

    const handleTournamentAnnouncement = (data) => {
      setTournamentData((prev) => ({
        ...prev,
        announcements: [...prev.announcements, data],
      }));
      callbacksRef.current.onAnnouncement?.(data);
    };

    const handleError = (err) => {
      setError(err.message);
      callbacksRef.current.onError?.(err);
    };

    // ---- Register all listeners ----
    SocketManager.on("tournament:joined", handleTournamentJoined);
    SocketManager.on("tournament:start", handleTournamentStart);
    SocketManager.on("tournament:announcement", handleTournamentAnnouncement);
    SocketManager.on("error", handleError);

    // ✅ Synchronous cleanup
    return () => {
      SocketManager.leaveTournament(tournamentId);
      SocketManager.off("tournament:joined", handleTournamentJoined);
      SocketManager.off("tournament:start", handleTournamentStart);
      SocketManager.off("tournament:announcement", handleTournamentAnnouncement);
      SocketManager.off("error", handleError);
      setIsConnected(false);
    };
  }, [tournamentId]);

  return {
    tournamentData,
    isConnected,
    error,
    startTournament: () => SocketManager.startTournament(tournamentId),
    sendAnnouncement: (message) =>
      SocketManager.sendTournamentAnnouncement(tournamentId, message),
  };
};

export default useTournamentSocket;