# CHATUZ - Global Random Video Chat

CHATUZ - bu butun dunyo bo'ylab odamlarni tasodifiy video muloqot orqali bog'laydigan zamonaviy platforma.

## Xususiyatlari
- **Tasodifiy bog'lanish**: Bir tugma orqali yangi suhbatdosh topish.
- **Ro'yxatdan o'tish shart emas**: Darhol muloqotni boshlash imkoniyati.
- **Xavfsizlik**: 18+ yosh tasdig'i va shikoyat qilish tizimi.
- **Zamonaviy dizayn**: O'zbek tilidagi interfeys, qulay va tezkor.
- **WebRTC**: To'g'ridan-to'g'ri (P2P) yuqori sifatli video va audio muloqot.

## Loyiha tarkibi
- `backend/`: Node.js + Socket.io signaling serveri.
- `frontend/`: React + Vite + WebRTC mijoz ilovasi.

## Ishga tushirish (Local)

### 1. Backendni ishga tushirish
```bash
cd backend
npm install
npm start
```

### 2. Frontendni ishga tushirish
```bash
cd frontend
npm install
npm run dev
```

## Production uchun joylashtirish (VPS)

### 1. Server tayyorlash
- VPS sotib oling (Ubuntu tavsiya etiladi).
- Node.js va NPM o'rnating.
- Domain va SSL sertifikatini (Nginx + Certbot) sozlang.

### 2. Backend deployment
- Backend kodini serverga yuklang.
- `PORT` va `CORS` sozlamalarini tekshiring.
- PM2 kabi process managerdan foydalaning:
  ```bash
  npm install -g pm2
  pm2 start index.js --name "chatuz-backend"
  ```

### 3. Frontend deployment
- `App.tsx` dagi `SOCKET_URL` ni production URL ga o'zgartiring.
- Build qiling: `npm run build`.
- `dist` papkasini Nginx orqali xizmat qiling.
- TURN server (masalan, Coturn) qo'shish tavsiya etiladi, agar P2P bog'lanishda muammo bo'lsa.

## Texnologiyalar
- Frontend: React, TypeScript, Vite, Lucide-react, Framer-motion.
- Backend: Node.js, Express, Socket.io.
- Protocol: WebRTC (Peer-to-Peer).

---
Loyiha CHATUZ jamoasi tomonidan taqdim etilgan.
