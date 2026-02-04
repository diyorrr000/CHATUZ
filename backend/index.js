import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;

// Health check route for Render
app.get('/', (req, res) => {
    res.send('CHATUZ Server is Running');
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Queue of objects: { id, info: { country, age } }
let waitingQueue = [];
// Map: socketId -> { partnerId, partnerInfo }
const activeChats = new Map();
// Simple user data cache: socketId -> userData
const users = new Map();

// Helper to broadcast real online count to all connected clients
function broadcastOnlineCount() {
    const totalOnline = io.engine.clientsCount;
    io.emit('online-count', totalOnline);
    console.log(`Real Online Count Broadcasted: ${totalOnline}`);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    broadcastOnlineCount();

    socket.on('join-queue', (userData) => {
        users.set(socket.id, userData);

        if (activeChats.has(socket.id)) {
            leaveChat(socket);
        }

        // Remove if already in queue to avoid duplicates
        waitingQueue = waitingQueue.filter(u => u.id !== socket.id);

        waitingQueue.push({ id: socket.id, info: userData });
        console.log(`User ${socket.id} joined pool: ${userData.country}`);

        matchUsers();
    });

    socket.on('next-user', () => {
        const userData = users.get(socket.id);
        leaveChat(socket, 'skipped');
        if (userData) {
            waitingQueue.push({ id: socket.id, info: userData });
            matchUsers();
        }
    });

    socket.on('send-message', (message) => {
        const chat = activeChats.get(socket.id);
        if (chat) {
            io.to(chat.partnerId).emit('receive-message', message);
        }
    });

    socket.on('report-user', () => {
        const chat = activeChats.get(socket.id);
        if (chat) {
            const partnerId = chat.partnerId;
            leaveChat(socket);

            const userData = users.get(socket.id);
            waitingQueue.push({ id: socket.id, info: userData });
            matchUsers();

            io.to(partnerId).emit('partner-disconnected');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        leaveChat(socket);
        waitingQueue = waitingQueue.filter(user => user.id !== socket.id);
        users.delete(socket.id);
        broadcastOnlineCount();
    });
});

function matchUsers() {
    console.log(`Checking matches... Queue size: ${waitingQueue.length}`);

    // We group users by their selected country pool
    const pools = {};
    waitingQueue.forEach(user => {
        const poolName = user.info.country;
        if (!pools[poolName]) pools[poolName] = [];
        pools[poolName].push(user);
    });

    // Match within each pool
    Object.keys(pools).forEach(poolName => {
        const pool = pools[poolName];
        while (pool.length >= 2) {
            const user1 = pool.shift();
            const user2 = pool.shift();

            // Remove from global waiting queue
            waitingQueue = waitingQueue.filter(u => u.id !== user1.id && u.id !== user2.id);

            activeChats.set(user1.id, { partnerId: user2.id, partnerInfo: user2.info });
            activeChats.set(user2.id, { partnerId: user1.id, partnerInfo: user1.info });

            io.to(user1.id).emit('match-found', {
                partnerId: user2.id,
                initiator: true,
                partnerInfo: user2.info
            });
            io.to(user2.id).emit('match-found', {
                partnerId: user1.id,
                initiator: false,
                partnerInfo: user1.info
            });

            console.log(`MATCH SUCCESS: ${user1.id} <-> ${user2.id} in ${poolName}`);
        }
    });
}

function leaveChat(socket, reason = 'left') {
    const chat = activeChats.get(socket.id);
    if (chat) {
        const partnerId = chat.partnerId;
        io.to(partnerId).emit('partner-disconnected', { reason });
        activeChats.delete(partnerId);
        activeChats.delete(socket.id);

        // Automatically put the abandoned partner back in queue
        const partnerData = users.get(partnerId);
        if (partnerData && !waitingQueue.find(u => u.id === partnerId)) {
            waitingQueue.push({ id: partnerId, info: partnerData });
            matchUsers();
        }
    }
}

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
