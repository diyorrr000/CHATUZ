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

app.get('/', (req, res) => {
    res.send('CHATUZ Server is Running');
});

// User data maps
let waitingQueue = [];
const activeChats = new Map(); // socket.id -> { partnerId, partnerNickname }
const users = new Map(); // socket.id -> { ip, joinedAt, nickname }
const admins = new Set();

function getClientIP(socket) {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return socket.handshake.address;
}

function broadcastAdminUpdate() {
    const userList = Array.from(users.entries()).map(([id, data]) => ({
        id,
        ...data,
        isAdmin: admins.has(id),
        status: activeChats.has(id) ? 'Chatda' : (waitingQueue.find(u => u.id === id) ? 'Navbatda' : 'Online')
    }));

    const stats = {
        total: io.engine.clientsCount,
        inChat: activeChats.size / 2,
        waiting: waitingQueue.length
    };

    io.to('admin-room').emit('admin-update', { users: userList, stats });
}

function broadcastOnlineCount() {
    io.emit('online-count', io.engine.clientsCount);
}

io.on('connection', (socket) => {
    const ip = getClientIP(socket);
    users.set(socket.id, { ip, joinedAt: Date.now(), nickname: 'Mehmon' });

    broadcastOnlineCount();
    broadcastAdminUpdate();

    socket.on('join-queue', (data) => {
        const nickname = data?.nickname || 'Mehmon';
        users.set(socket.id, { ...users.get(socket.id), nickname });

        // Clean up from any existing chats or queues
        removeFromQueue(socket.id);

        waitingQueue.push({ id: socket.id, nickname });
        matchUsers();
        broadcastAdminUpdate();
    });

    socket.on('next-user', () => {
        const userData = users.get(socket.id);
        leaveChat(socket, 'skipped');

        // Add back to queue if not already there
        if (!waitingQueue.find(u => u.id === socket.id)) {
            waitingQueue.push({ id: socket.id, nickname: userData?.nickname || 'Mehmon' });
            matchUsers();
        }
        broadcastAdminUpdate();
    });

    socket.on('send-message', (message) => {
        const chat = activeChats.get(socket.id);
        const userData = users.get(socket.id);
        if (chat) {
            io.to(chat.partnerId).emit('receive-message', {
                ...message,
                senderNickname: userData?.nickname,
                timestamp: Date.now()
            });

            // Log for admin
            io.to('admin-room').emit('admin-new-message', {
                from: userData?.nickname || socket.id,
                to: users.get(chat.partnerId)?.nickname || 'Partner',
                text: message.text,
                hasFile: !!message.file,
                timestamp: Date.now()
            });
        }
    });

    socket.on('admin-login', (pass) => {
        if (pass === '1212') {
            socket.join('admin-room');
            admins.add(socket.id);
            socket.emit('admin-auth-success');
            broadcastAdminUpdate();
        }
    });

    socket.on('disconnect', () => {
        leaveChat(socket);
        removeFromQueue(socket.id);
        users.delete(socket.id);
        admins.delete(socket.id);
        broadcastOnlineCount();
        broadcastAdminUpdate();
    });
});

function removeFromQueue(socketId) {
    waitingQueue = waitingQueue.filter(u => u.id !== socketId);
}

function matchUsers() {
    while (waitingQueue.length >= 2) {
        const user1 = waitingQueue.shift();
        const user2 = waitingQueue.shift();

        activeChats.set(user1.id, { partnerId: user2.id, partnerNickname: user2.nickname });
        activeChats.set(user2.id, { partnerId: user1.id, partnerNickname: user1.nickname });

        io.to(user1.id).emit('match-found', { partnerNickname: user2.nickname });
        io.to(user2.id).emit('match-found', { partnerNickname: user1.nickname });
    }
}

function leaveChat(socket, reason = 'left') {
    const chat = activeChats.get(socket.id);
    if (chat) {
        const partnerId = chat.partnerId;

        // Tell the partner they are alone
        io.to(partnerId).emit('partner-disconnected', { reason });

        // Remove both from active chats
        activeChats.delete(partnerId);
        activeChats.delete(socket.id);

        // Put the partner back in queue if they are still connected
        const partnerData = users.get(partnerId);
        if (partnerData && !waitingQueue.find(u => u.id === partnerId)) {
            waitingQueue.push({ id: partnerId, nickname: partnerData.nickname });
            matchUsers();
        }
    }
}

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
