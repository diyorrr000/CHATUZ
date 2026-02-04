import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 5000;

let waitingQueue = [];
const activeChats = new Map(); // socket.id -> { partnerId, pairId }
const users = new Map(); // socket.id -> { nickname, ip, uid }
const currentAdmins = new Set(); // socket.id of active admins
const permanentAdmins = new Set(); // uids of permanent admins

function getClientIP(socket) {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0].trim() : socket.handshake.address;
}

function broadcastAdminUpdate() {
    const userList = Array.from(users.entries()).map(([id, data]) => ({
        id,
        nickname: data.nickname,
        ip: data.ip,
        uid: data.uid,
        isAdmin: currentAdmins.has(id) || (data.uid && permanentAdmins.has(data.uid)),
        status: activeChats.has(id) ? 'Chatda' : (waitingQueue.find(u => u.id === id) ? 'Navbatda' : 'Online')
    }));
    io.to('admin-room').emit('admin-update', {
        users: userList,
        stats: { total: io.engine.clientsCount, inChat: activeChats.size / 2, waiting: waitingQueue.length }
    });
}

io.on('connection', (socket) => {
    const ip = getClientIP(socket);
    users.set(socket.id, { nickname: 'Mehmon', ip });

    io.emit('online-count', io.engine.clientsCount);
    broadcastAdminUpdate();

    socket.on('join-queue', (data) => {
        const nickname = data?.nickname || 'Mehmon';
        const uid = data?.uid;
        users.set(socket.id, { ...users.get(socket.id), nickname, uid });

        // Auto-login if permanent admin
        if (uid && permanentAdmins.has(uid)) {
            currentAdmins.add(socket.id);
            socket.join('admin-room');
            socket.emit('admin-auth-success');
        }

        cleanupUser(socket.id);
        waitingQueue.push({ id: socket.id, nickname });
        matchUsers();
        broadcastAdminUpdate();
    });

    socket.on('grant-admin', (targetId) => {
        if (currentAdmins.has(socket.id)) {
            const targetUser = users.get(targetId);
            if (targetUser && targetUser.uid) {
                permanentAdmins.add(targetUser.uid);
                currentAdmins.add(targetId);
                const targetSocket = io.sockets.sockets.get(targetId);
                if (targetSocket) targetSocket.join('admin-room');
                io.to(targetId).emit('admin-auth-success');
                broadcastAdminUpdate();
            }
        }
    });

    socket.on('revoke-admin', (targetId) => {
        if (currentAdmins.has(socket.id)) {
            const targetUser = users.get(targetId);
            if (targetUser && targetUser.uid) {
                permanentAdmins.delete(targetUser.uid);
                currentAdmins.delete(targetId);
                const targetSocket = io.sockets.sockets.get(targetId);
                if (targetSocket) targetSocket.leave('admin-room');
                io.to(targetId).emit('admin-revoked');
                broadcastAdminUpdate();
            }
        }
    });

    socket.on('next-user', () => {
        cleanupUser(socket.id, 'skipped');
        const userData = users.get(socket.id);
        waitingQueue.push({ id: socket.id, nickname: userData?.nickname || 'Mehmon' });
        matchUsers();
        broadcastAdminUpdate();
    });

    socket.on('send-message', (payload) => {
        const chat = activeChats.get(socket.id);
        const userData = users.get(socket.id);
        if (chat && chat.partnerId) {
            const partnerChat = activeChats.get(chat.partnerId);
            if (partnerChat && partnerChat.pairId === chat.pairId) {
                const isMsgAdmin = currentAdmins.has(socket.id) || (userData?.uid && permanentAdmins.has(userData.uid));
                io.to(chat.partnerId).emit('receive-message', {
                    ...payload,
                    senderNickname: userData?.nickname,
                    isAdmin: isMsgAdmin,
                    timestamp: Date.now()
                });

                // Admin log
                io.to('admin-room').emit('admin-new-message', {
                    from: userData?.nickname || 'Anon',
                    to: users.get(chat.partnerId)?.nickname || 'Anon',
                    text: payload.text,
                    hasFile: !!payload.file,
                    timestamp: Date.now()
                });
            }
        }
    });

    socket.on('typing', (isTyping) => {
        const chat = activeChats.get(socket.id);
        if (chat && chat.partnerId) {
            io.to(chat.partnerId).emit('partner-typing', isTyping);
        }
    });

    socket.on('admin-login', (pass) => {
        if (pass === '1212') {
            socket.join('admin-room');
            currentAdmins.add(socket.id);
            socket.emit('admin-auth-success');
            broadcastAdminUpdate();
        }
    });

    socket.on('disconnect', () => {
        cleanupUser(socket.id);
        users.delete(socket.id);
        currentAdmins.delete(socket.id);
        io.emit('online-count', io.engine.clientsCount);
        broadcastAdminUpdate();
    });
});

function cleanupUser(socketId, reason = 'left') {
    const chat = activeChats.get(socketId);
    if (chat) {
        const partnerId = chat.partnerId;
        io.to(partnerId).emit('partner-disconnected', { reason });
        activeChats.delete(partnerId);
        activeChats.delete(socketId);
    }
    waitingQueue = waitingQueue.filter(u => u.id !== socketId);
}

function matchUsers() {
    while (waitingQueue.length >= 2) {
        const user1 = waitingQueue.shift();
        const user2 = waitingQueue.shift();
        const pairId = uuidv4();

        activeChats.set(user1.id, { partnerId: user2.id, pairId });
        activeChats.set(user2.id, { partnerId: user1.id, pairId });

        io.to(user1.id).emit('match-found', { partnerNickname: user2.nickname });
        io.to(user2.id).emit('match-found', { partnerNickname: user1.nickname });
    }
}

httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
