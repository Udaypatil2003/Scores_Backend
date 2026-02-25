import { useEffect, useRef, useState } from "react";
import SocketManager from "./SocketManager";

const useMatchSocket = (matchId, callbacks = {}) => {
  const [matchData, setMatchData] = useState({
    score: { home: 0, away: 0 },
    status: null,
    events: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!matchId) return;

    // Join room
    SocketManager.joinMatch(matchId);
    setIsConnected(true);

    // ---- Define handlers ----
    const handleMatchJoined = (data) => {
      callbacksRef.current.onJoined?.(data);
    };

    const handleMatchStart = (data) => {
      setMatchData((prev) => ({
        ...prev,
        status: data.status,
        startedAt: data.startedAt,
      }));
      callbacksRef.current.onStart?.(data);
    };

    const handleMatchEnd = (data) => {
      setMatchData((prev) => ({
        ...prev,
        status: data.status,
        completedAt: data.completedAt,
        winner: data.winner,
      }));
      callbacksRef.current.onEnd?.(data);
    };

    const handleGoal = (data) => {
      setMatchData((prev) => ({
        ...prev,
        score: data.score,
        events: [...prev.events, data.event],
      }));
      callbacksRef.current.onGoal?.(data);
    };

    const handleCard = (data) => {
      setMatchData((prev) => ({
        ...prev,
        events: [...prev.events, data.event],
      }));
      callbacksRef.current.onCard?.(data);
    };

    const handleSubstitution = (data) => {
      setMatchData((prev) => ({
        ...prev,
        events: [...prev.events, data.event],
      }));
      callbacksRef.current.onSubstitution?.(data);
    };

    const handleStatusUpdate = (data) => {
      setMatchData((prev) => ({ ...prev, status: data.status }));
      callbacksRef.current.onStatusUpdate?.(data);
    };

    const handleMatchReset = (data) => {
      setMatchData({
        score: data.score,
        status: data.status,
        events: [],
        startedAt: null,
        completedAt: null,
        winner: null,
      });
      callbacksRef.current.onReset?.(data);
    };

    const handleError = (err) => {
      setError(err.message);
      callbacksRef.current.onError?.(err);
    };

    // ---- Register all listeners ----
    SocketManager.on("match:joined", handleMatchJoined);
    SocketManager.on("match:start", handleMatchStart);
    SocketManager.on("match:end", handleMatchEnd);
    SocketManager.on("match:goal", handleGoal);
    SocketManager.on("match:card", handleCard);
    SocketManager.on("match:substitution", handleSubstitution);
    SocketManager.on("match:status", handleStatusUpdate);
    SocketManager.on("match:reset", handleMatchReset);
    SocketManager.on("error", handleError);

    // ✅ Synchronous cleanup — no async wrapper
    return () => {
      SocketManager.leaveMatch(matchId);
      SocketManager.off("match:joined", handleMatchJoined);
      SocketManager.off("match:start", handleMatchStart);
      SocketManager.off("match:end", handleMatchEnd);
      SocketManager.off("match:goal", handleGoal);
      SocketManager.off("match:card", handleCard);
      SocketManager.off("match:substitution", handleSubstitution);
      SocketManager.off("match:status", handleStatusUpdate);
      SocketManager.off("match:reset", handleMatchReset);
      SocketManager.off("error", handleError);
      setIsConnected(false);
    };
  }, [matchId]); // ← only re-runs if matchId changes

  return {
    matchData,
    isConnected,
    error,
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
