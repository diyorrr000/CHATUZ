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
const currentAdmins = new Set(); // socket.id of active admins (any level)
const superAdmins = new Set(); // socket.id of users who logged in with password
const permanentAdmins = new Set(); // uids of permanent admins
const groupRooms = new Map(); // roomId -> { name, creatorId, members: Set(socket.id) }

function getClientIP(socket) {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0].trim() : socket.handshake.address;
}

function broadcastAdminUpdate() {
    const userList = Array.from(users.entries()).map(([id, data]) => {
        const isSuper = superAdmins.has(id);
        const isPermanent = data.uid && permanentAdmins.has(data.uid);
        const isCurrent = currentAdmins.has(id);

        return {
            id,
            nickname: data.nickname,
            ip: data.ip,
            uid: data.uid,
            isSuperAdmin: isSuper,
            isKichikAdmin: (isPermanent || isCurrent) && !isSuper,
            status: activeChats.has(id) ? 'Chatda' : (waitingQueue.find(u => u.id === id) ? 'Navbatda' : 'Online'),
            chatPartnerId: activeChats.get(id)?.partnerId
        };
    });

    io.to('admin-room').emit('admin-update', {
        users: userList,
        stats: {
            total: io.engine.clientsCount,
            inChat: activeChats.size / 2,
            waiting: waitingQueue.length,
            groups: groupRooms.size
        }
    });
}

io.on('connection', (socket) => {
    const ip = getClientIP(socket);
    users.set(socket.id, { nickname: 'Mehmon', ip });

    io.emit('online-count', io.engine.clientsCount);
    broadcastAdminUpdate();

    socket.on('init', (data) => {
        const uid = data?.uid;
        if (uid) {
            users.set(socket.id, { ...users.get(socket.id), uid });
            if (permanentAdmins.has(uid)) {
                currentAdmins.add(socket.id);
                socket.join('admin-room');
                socket.emit('admin-auth-success', { level: 'kichik' });
            }
            broadcastAdminUpdate();
        }
    });

    socket.on('join-queue', (data) => {
        const nickname = data?.nickname || 'Mehmon';
        const uid = data?.uid;
        users.set(socket.id, { ...users.get(socket.id), nickname, uid });

        cleanupUser(socket.id);
        waitingQueue.push({ id: socket.id, nickname });
        matchUsers();
        broadcastAdminUpdate();
    });

    socket.on('grant-admin', (targetId) => {
        if (superAdmins.has(socket.id)) {
            const targetUser = users.get(targetId);
            if (targetUser && targetUser.uid) {
                permanentAdmins.add(targetUser.uid);
                currentAdmins.add(targetId);
                const targetSocket = io.sockets.sockets.get(targetId);
                if (targetSocket) targetSocket.join('admin-room');
                io.to(targetId).emit('admin-auth-success', { level: 'kichik' });
                broadcastAdminUpdate();
            }
        }
    });

    socket.on('revoke-admin', (targetId) => {
        if (superAdmins.has(socket.id)) {
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

    socket.on('spy-chat', (targetId) => {
        if (superAdmins.has(socket.id)) {
            const chat = activeChats.get(targetId);
            if (chat) {
                socket.emit('spy-link-ready', {
                    partner1: users.get(targetId)?.nickname,
                    partner2: users.get(chat.partnerId)?.nickname,
                    pairId: chat.pairId
                });
                socket.join(`chat-${chat.pairId}`);
            }
        }
    });

    socket.on('create-group', (roomName) => {
        if (currentAdmins.has(socket.id) || superAdmins.has(socket.id)) {
            const roomId = 'group_' + uuidv4();
            groupRooms.set(roomId, { name: roomName, creatorId: socket.id, members: new Set([socket.id]) });
            socket.join(roomId);
            socket.emit('group-created', { roomId, name: roomName });
            broadcastAdminUpdate();
        }
    });

    socket.on('invite-user', ({ roomId, targetId }) => {
        const room = groupRooms.get(roomId);
        if (room && (room.creatorId === socket.id || superAdmins.has(socket.id))) {
            const inviterNickname = users.get(socket.id)?.nickname;
            io.to(targetId).emit('group-invitation', { roomId, roomName: room.name, inviter: inviterNickname });
        }
    });

    socket.on('join-group', (roomId) => {
        const room = groupRooms.get(roomId);
        if (room) {
            room.members.add(socket.id);
            socket.join(roomId);
            io.to(roomId).emit('group-message', {
                sender: 'system',
                text: `${users.get(socket.id)?.nickname} guruhga qo'shildi.`,
                timestamp: Date.now()
            });
            socket.emit('group-joined', { roomId, name: room.name });
        }
    });

    socket.on('send-message', (payload) => {
        const chat = activeChats.get(socket.id);
        const userData = users.get(socket.id);

        if (payload.roomId) { // Group message
            io.to(payload.roomId).emit('group-message', {
                ...payload,
                senderNickname: userData?.nickname,
                isAdmin: currentAdmins.has(socket.id) || superAdmins.has(socket.id),
                timestamp: Date.now()
            });
            return;
        }

        if (chat && chat.partnerId) {
            const isMsgSuper = superAdmins.has(socket.id);
            const isMsgKichik = (currentAdmins.has(socket.id) || (userData?.uid && permanentAdmins.has(userData.uid))) && !isMsgSuper;

            const messageData = {
                ...payload,
                senderNickname: userData?.nickname,
                isAdmin: isMsgSuper || isMsgKichik,
                isSuperAdmin: isMsgSuper,
                timestamp: Date.now()
            };

            io.to(`chat-${chat.pairId}`).emit('receive-message', messageData);
            // Backup emit for cases where room join isn't automatic
            io.to(chat.partnerId).emit('receive-message', messageData);

            io.to('super-admin-room').emit('admin-new-message', {
                from: userData?.nickname || 'Anon',
                to: users.get(chat.partnerId)?.nickname || 'Anon',
                text: payload.text,
                hasFile: !!payload.file,
                timestamp: Date.now()
            });
        }
    });

    socket.on('admin-login', (pass) => {
        if (pass === '1212') {
            socket.join('admin-room');
            socket.join('super-admin-room');
            superAdmins.add(socket.id);
            currentAdmins.add(socket.id);
            socket.emit('admin-auth-success', { level: 'katta' });
            broadcastAdminUpdate();
        }
    });

    socket.on('disconnect', () => {
        cleanupUser(socket.id);
        users.delete(socket.id);
        currentAdmins.delete(socket.id);
        superAdmins.delete(socket.id);

        // Cleanup groups
        for (const [roomId, room] of groupRooms.entries()) {
            if (room.members.has(socket.id)) {
                room.members.delete(socket.id);
                if (room.members.size === 0) {
                    groupRooms.delete(roomId);
                } else {
                    io.to(roomId).emit('group-message', {
                        sender: 'system',
                        text: `${users.get(socket.id)?.nickname} guruhni tark etdi.`,
                        timestamp: Date.now()
                    });
                }
            }
        }

        io.emit('online-count', io.engine.clientsCount);
        broadcastAdminUpdate();
    });
});

function cleanupUser(socketId, reason = 'left') {
    const chat = activeChats.get(socketId);
    if (chat) {
        const partnerId = chat.partnerId;
        io.to(partnerId).emit('partner-disconnected', { reason });
        io.to(`chat-${chat.pairId}`).emit('partner-disconnected', { reason });
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

        const s1 = io.sockets.sockets.get(user1.id);
        const s2 = io.sockets.sockets.get(user2.id);
        if (s1) s1.join(`chat-${pairId}`);
        if (s2) s2.join(`chat-${pairId}`);

        io.to(user1.id).emit('match-found', { partnerNickname: user2.nickname });
        io.to(user2.id).emit('match-found', { partnerNickname: user1.nickname });
    }
}

httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
