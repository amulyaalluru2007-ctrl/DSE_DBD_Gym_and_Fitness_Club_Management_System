import { Server } from "socket.io";

let ioInstance = null;

export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
  });

  ioInstance.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on("join", (room) => {
      socket.join(room);
      console.log(`[Socket.io] Socket ${socket.id} joined room ${room}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
};

export const getIO = () => ioInstance;

export const broadcastEvent = (event, data) => {
  if (ioInstance) {
    ioInstance.emit(event, data);
    console.log(`[Socket.io Broadcast] -> Event: "${event}"`, data?.title || data?.message || data?.status || "");
  }
};
