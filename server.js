// socketServer.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { ClerkExpressWithAuth } = require("@clerk/clerk-sdk-node");
require("dotenv").config();

// Import routes
const messageRoutes = require("./routes/messages.js");
const direct_message = require("./routes/direct-messages.js");

const app = express();
const server = http.createServer(app);

app.use(express.json());
// Enable CORS for Express
app.use(
  cors({
    origin: "http://localhost:3000", // Allow your Next.js frontend to connect
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  })
);

// Ensure Clerk keys are set up in your environment variables
app.use(
  ClerkExpressWithAuth({
    secretKey: process.env.CLERK_SECRET_KEY, // Use CLERK_SECRET_KEY here
  })
);

app.use("/messages", messageRoutes);
app.use("/direct-messages", direct_message);

// Set up Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Allow your Next.js frontend to connect
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.io = io;

// Handle Socket.IO connections
io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Handle a custom event
  socket.on("message", (data) => {
    console.log("Message received:", data);
    io.emit("message", data); // Broadcast the message to all clients
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Socket.IO server is running on http://localhost:${PORT}`);
});
