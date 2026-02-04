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

// Queue of objects: { id, info: { country, age } }
let waitingQueue = [];
// Map: socketId -> { partnerId, partnerInfo }
const activeChats = new Map();
// Simple user data cache: socketId -> userData
const users = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-queue', (userData) => {
        users.set(socket.id, userData);

        if (activeChats.has(socket.id)) {
            leaveChat(socket);
        }

        if (!waitingQueue.find(user => user.id === socket.id)) {
            waitingQueue.push({ id: socket.id, info: userData });
            console.log(`User joined queue: ${socket.id} (${userData.country})`);
            matchUsers();
        }
    });

    socket.on('next-user', () => {
        const userData = users.get(socket.id);
        leaveChat(socket);
        waitingQueue.push({ id: socket.id, info: userData });
        matchUsers();
    });

    socket.on('signal', (data) => {
        const chat = activeChats.get(socket.id);
        if (chat) {
            io.to(chat.partnerId).emit('signal', { ...data, from: socket.id });
        }
    });

    socket.on('send-message', (message) => {
        const chat = activeChats.get(socket.id);
        if (chat) {
            io.to(chat.partnerId).emit('receive-message', {
                text: message,
                sender: 'partner'
            });
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
    });
});

function matchUsers() {
    // We need to match users who have the SAME selected regional preference
    // or handle "Global" specifically.

    // Get all unique countries in the queue
    const pendingCountries = [...new Set(waitingQueue.map(u => u.info.country))];

    pendingCountries.forEach(country => {
        // Filter users waiting for this specific country
        let sameCountryUsers = waitingQueue.filter(u => u.info.country === country);

        while (sameCountryUsers.length >= 2) {
            const user1 = sameCountryUsers.shift();
            const user2 = sameCountryUsers.shift();

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

            console.log(`Matched ${user1.id} with ${user2.id} in pool: ${country}`);
        }
    });
}

function leaveChat(socket) {
    const chat = activeChats.get(socket.id);
    if (chat) {
        const partnerId = chat.partnerId;
        io.to(partnerId).emit('partner-disconnected');
        activeChats.delete(partnerId);
        activeChats.delete(socket.id);

        if (!waitingQueue.find(u => u.id === partnerId)) {
            const partnerData = users.get(partnerId);
            if (partnerData) {
                waitingQueue.push({ id: partnerId, info: partnerData });
                matchUsers();
            }
        }
    }
    waitingQueue = waitingQueue.filter(u => u.id !== socket.id);
}

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
