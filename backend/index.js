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

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

let waitingQueue = [];
const activeChats = new Map();
const users = new Map();
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
    const totalOnline = io.engine.clientsCount;
    io.emit('online-count', totalOnline);
}

io.on('connection', (socket) => {
    const ip = getClientIP(socket);
    console.log('User connected:', socket.id, 'IP:', ip);

    users.set(socket.id, { ip, joinedAt: Date.now() });
    broadcastOnlineCount();
    broadcastAdminUpdate();

    socket.on('admin-login', (pass) => {
        if (pass === '1212') {
            socket.join('admin-room');
            admins.add(socket.id);
            socket.emit('admin-auth-success');
            broadcastAdminUpdate();
        }
    });

    socket.on('join-queue', () => {
        if (activeChats.has(socket.id)) {
            leaveChat(socket);
        }
        waitingQueue = waitingQueue.filter(u => u.id !== socket.id);
        waitingQueue.push({ id: socket.id });
        matchUsers();
        broadcastAdminUpdate();
    });

    socket.on('next-user', () => {
        leaveChat(socket, 'skipped');
        if (!waitingQueue.find(u => u.id === socket.id)) {
            waitingQueue.push({ id: socket.id });
            matchUsers();
            broadcastAdminUpdate();
        }
    });

    socket.on('send-message', (message) => {
        const chat = activeChats.get(socket.id);
        if (chat) {
            io.to(chat.partnerId).emit('receive-message', message);

            // Broadcast to admins for monitoring
            io.to('admin-room').emit('admin-new-message', {
                from: socket.id,
                to: chat.partnerId,
                text: message.text,
                hasFile: !!message.file,
                timestamp: Date.now()
            });
        }
    });

    socket.on('report-user', () => {
        const chat = activeChats.get(socket.id);
        if (chat) {
            const partnerId = chat.partnerId;
            leaveChat(socket);
            if (!waitingQueue.find(u => u.id === socket.id)) {
                waitingQueue.push({ id: socket.id });
                matchUsers();
            }
            io.to(partnerId).emit('partner-disconnected', { reason: 'left' });
        }
        broadcastAdminUpdate();
    });

    socket.on('disconnect', () => {
        leaveChat(socket);
        waitingQueue = waitingQueue.filter(user => user.id !== socket.id);
        users.delete(socket.id);
        admins.delete(socket.id);
        broadcastOnlineCount();
        broadcastAdminUpdate();
    });
});

function matchUsers() {
    while (waitingQueue.length >= 2) {
        const user1 = waitingQueue.shift();
        const user2 = waitingQueue.shift();

        activeChats.set(user1.id, { partnerId: user2.id });
        activeChats.set(user2.id, { partnerId: user1.id });

        io.to(user1.id).emit('match-found', { partnerId: user2.id });
        io.to(user2.id).emit('match-found', { partnerId: user1.id });
    }
}

function leaveChat(socket, reason = 'left') {
    const chat = activeChats.get(socket.id);
    if (chat) {
        const partnerId = chat.partnerId;
        io.to(partnerId).emit('partner-disconnected', { reason });
        activeChats.delete(partnerId);
        activeChats.delete(socket.id);

        if (!waitingQueue.find(u => u.id === partnerId)) {
            waitingQueue.push({ id: partnerId });
            matchUsers();
        }
    }
}

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
