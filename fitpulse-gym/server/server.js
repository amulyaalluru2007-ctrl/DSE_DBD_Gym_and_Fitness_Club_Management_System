import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDatabase from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";
import { initSocket } from "./socket.js";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

/* =====================================================
   DATABASE & SOCKET.IO INITIALIZATION
===================================================== */
await connectDatabase();
initSocket(httpServer);

/* =====================================================
   MIDDLEWARE
===================================================== */
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

/* =====================================================
   HEALTH CHECK
===================================================== */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FitPulse real-time backend is running with MySQL & Socket.io.",
    timestamp: new Date().toISOString(),
  });
});

/* =====================================================
   API ROUTES
===================================================== */
app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

/* =====================================================
   404 HANDLER
===================================================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

/* =====================================================
   SERVER START
===================================================== */
httpServer.listen(PORT, () => {
  console.log(`[FitPulse Server] WebSocket & REST API running on http://localhost:${PORT}`);
});