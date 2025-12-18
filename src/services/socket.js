import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

let socket = null;

export const connectSocket = async () => {
  if (socket) return socket;

  const token = await AsyncStorage.getItem("token");
  if (!token) return null;

  socket = io("http://192.168.0.140:5000", {
    transports: ["websocket"],
    auth: {
      token,
    },
  });

  socket.on("connect", () => {
    console.log("🔌 Socket connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected");
  });

  socket.on("connect_error", (err) => {
    console.log("Socket error:", err.message);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
