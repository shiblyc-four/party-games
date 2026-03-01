import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { GameRoom } from './rooms/GameRoom.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = CLIENT_URL.split(',').map((s) => s.trim());

const app = express();

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

app.use(express.json());

// Health check endpoint (for Render)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

const httpServer = createServer(app);

const gameServer = new Server({
    transport: new WebSocketTransport({
        server: httpServer,
        pingInterval: 10000,
        pingMaxRetries: 6,
    }),
});

// Register game rooms
gameServer.define('pictionary', GameRoom);

// Start listening
httpServer.listen(PORT, () => {
    console.log(`\n🚀 Game server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket ready for connections`);
    console.log(`🌐 Allowing client origin: ${CLIENT_URL}\n`);
});
