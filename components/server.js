const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const bcrypt = require("bcryptjs");
const cors = require("cors");
const WebSocket = require("ws");

const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cors());

// ✅ Attach WebSocket to the existing HTTP server
const wss = new WebSocket.Server({ server });

const clients = new Map();
const rooms = new Map();

wss.on("connection", (ws, req) => {
  console.log("New WebSocket connection established");

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "join_room") {
        const { senderId, receiverId } = data;
        const roomId = [senderId, receiverId].sort().join("_");
        ws.userId = senderId;
        ws.roomId = roomId;

        if (!clients.has(senderId)) {
          clients.set(senderId, []);
        }
        clients.get(senderId).push(ws);

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(ws);

        console.log(`User ${senderId} joined room ${roomId}`);
      }

      if (data.type === "send_message") {
        const { senderId, receiverId, senderName, receiverName, message, image } = data;

        const newMessage = {
          senderId,
          receiverId,
          senderName,
          receiverName,
          text: message,
          image,
          unread: true,
        };

        const roomId = [senderId, receiverId].sort().join("_");
        console.log(`Message sent to room ${roomId}: ${message}`);

        if (rooms.has(roomId)) {
          rooms.get(roomId).forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "receive_message", message: newMessage }));
            }
          });
        }
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");

    if (ws.userId && clients.has(ws.userId)) {
      clients.set(
        ws.userId,
        clients.get(ws.userId).filter((client) => client !== ws)
      );

      if (clients.get(ws.userId).length === 0) {
        clients.delete(ws.userId);
      }
    }

    if (ws.roomId && rooms.has(ws.roomId)) {
      rooms.get(ws.roomId).delete(ws);
      if (rooms.get(ws.roomId).size === 0) {
        rooms.delete(ws.roomId);
      }
    }
  });
});

// ✅ Use `server.listen` instead of `app.listen`
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
