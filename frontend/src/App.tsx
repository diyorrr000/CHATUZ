import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Play, Square, User, Send, Moon, Sun, Paperclip, File as FileIcon, Download, ShieldCheck, Activity, Users, Clock } from 'lucide-react';
import AgeConfirmation from './components/AgeConfirmation';

const SOCKET_URL = 'https://chatuz-backendd.onrender.com';

interface Message {
  text?: string;
  file?: {
    name: string;
    type: string;
    data: string; // Base64
  };
  sender: 'me' | 'partner';
  senderNickname?: string;
  timestamp: number;
}

interface AdminData {
  users: any[];
  stats: {
    total: number;
    inChat: number;
    waiting: number;
  };
}

interface AdminGlobalMessage {
  from: string;
  to: string;
  text?: string;
  hasFile: boolean;
  timestamp: number;
}

const App = () => {
  const [userData, setUserData] = useState<{ nickname: string } | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerNickname, setPartnerNickname] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Admin states
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [globalMessages, setGlobalMessages] = useState<AdminGlobalMessage[]>([]);
  const typedKeys = useRef<string>('');
  const logoClicks = useRef<number>(0);

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const adminMsgEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Scroll admin messages
  useEffect(() => {
    adminMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages]);

  const triggerAdminLogin = () => {
    const pass = prompt('Admin paroli:');
    if (pass === '1212') {
      socketRef.current?.emit('admin-login', pass);
    } else if (pass !== null) {
      alert('Noto\'g\'ri parol!');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      typedKeys.current += e.key.toLowerCase();
      if (typedKeys.current.includes('admin')) {
        triggerAdminLogin();
        typedKeys.current = '';
      }
      if (typedKeys.current.length > 10) typedKeys.current = typedKeys.current.slice(-5);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogoClick = () => {
    logoClicks.current += 1;
    if (logoClicks.current >= 5) {
      triggerAdminLogin();
      logoClicks.current = 0;
    }
    setTimeout(() => { logoClicks.current = 0; }, 3000);
  };

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('online-count', (count: number) => setOnlineCount(count));

    socket.on('match-found', (data: { partnerNickname: string }) => {
      setInQueue(false);
      setPartnerConnected(true);
      setPartnerNickname(data.partnerNickname);
      setMessages([{
        text: `Suhbatdosh topildi: ${data.partnerNickname}! Salom deng 😊`,
        sender: 'partner',
        senderNickname: data.partnerNickname,
        timestamp: Date.now()
      }]);
    });

    socket.on('partner-disconnected', (data?: { reason: string }) => {
      setPartnerConnected(false);
      setInQueue(true);
      socketRef.current?.emit('join-queue', userData);
      const leaveMessage = data?.reason === 'skipped'
        ? "Suhbatdosh 'Keyingisi' tugmasini bosdi. Yangi suhbatdosh qidirilmoqda..."
        : "Suhbatdosh tark etdi. Yangi suhbatdosh qidirilmoqda...";
      setMessages(prev => [...prev, { text: leaveMessage, sender: 'partner', timestamp: Date.now() }]);
    });

    socket.on('receive-message', (msg: any) => {
      setMessages(prev => [...prev, { ...msg, sender: 'partner', timestamp: Date.now() }]);
    });

    socket.on('admin-auth-success', () => {
      setIsAdmin(true);
      setShowAdminPanel(true);
      alert('Admin sifatida muvaffaqiyatli kirdingiz!');
    });

    socket.on('admin-update', (data: AdminData) => {
      setAdminData(data);
    });

    socket.on('admin-new-message', (msg: AdminGlobalMessage) => {
      setGlobalMessages(prev => [...prev, msg].slice(-100)); // Keep last 100
    });

    return () => { socket.disconnect(); };
  }, [userData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleChat = () => {
    if (!inQueue && !partnerConnected) {
      setInQueue(true);
      socketRef.current?.emit('join-queue', userData);
    } else {
      setInQueue(false);
      setPartnerConnected(false);
      socketRef.current?.emit('next-user');
    }
  };

  const nextUser = () => {
    setPartnerConnected(false);
    setMessages([]);
    setInQueue(true);
    socketRef.current?.emit('next-user');
  };

  const sendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !partnerConnected) return;
    const msg: Partial<Message> = { text: inputValue };
    socketRef.current?.emit('send-message', msg);
    setMessages(prev => [...prev, { text: inputValue, sender: 'me', senderNickname: userData?.nickname, timestamp: Date.now() }]);
    setInputValue('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !partnerConnected) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      const fileMsg: Partial<Message> = { file: { name: file.name, type: file.type, data: base64Data } };
      socketRef.current?.emit('send-message', fileMsg);
      setMessages(prev => [...prev, { file: { name: file.name, type: file.type, data: base64Data }, sender: 'me', senderNickname: userData?.nickname, timestamp: Date.now() }]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!userData) {
    return <AgeConfirmation realOnlineCount={onlineCount} onConfirm={(data) => setUserData(data)} />;
  }

  return (
    <div className="app-container chat-only">
      {showAdminPanel && isAdmin && (
        <div className="admin-overlay">
          <div className="admin-modal wide">
            <div className="admin-header">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-blue-500" />
                <h2 style={{ color: 'white' }}>Live Monitoring Paneli</h2>
              </div>
              <Activity className="text-blue-500 animate-pulse" />
              <button className="close-admin" onClick={() => setShowAdminPanel(false)}>Yopish</button>
            </div>

            <div className="admin-stats">
              <div className="stat-card">
                <Users size={20} />
                <div className="val">{adminData?.stats.total || 0}</div>
                <div className="lab">Jami</div>
              </div>
              <div className="stat-card">
                <Activity size={20} />
                <div className="val">{adminData?.stats.inChat || 0}</div>
                <div className="lab">Suhbatda</div>
              </div>
              <div className="stat-card">
                <Clock size={20} />
                <div className="val">{adminData?.stats.waiting || 0}</div>
                <div className="lab">Navbatda</div>
              </div>
            </div>

            <div className="admin-content-grid">
              <div className="admin-user-list scrollbar-hide">
                <h3>FOYDALANUVCHILAR</h3>
                <table>
                  <thead>
                    <tr><th>NIK</th><th>IP</th><th>STATUS</th></tr>
                  </thead>
                  <tbody>
                    {adminData?.users.map((u, i) => (
                      <tr key={i} className={u.id === socketRef.current?.id ? 'is-me' : ''}>
                        <td className="font-bold text-blue-300">{u.nickname || 'Anonim'}</td>
                        <td className="font-mono text-[10px] text-blue-400">{u.ip}</td>
                        <td><span className={`status-pill ${u.status === 'Chatda' ? 'bg-green-500' : 'bg-blue-500'}`}>{u.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-global-chat scrollbar-hide">
                <h3>LIVE CHAT MONITORING</h3>
                <div className="admin-messages">
                  {globalMessages.length === 0 && <p className="opacity-20 text-center mt-10">Hozircha xabarlar yo'q...</p>}
                  {globalMessages.map((gm, i) => (
                    <div key={i} className="admin-msg-row">
                      <span className="time">{new Date(gm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span className="ids">[{gm.from} → {gm.to}]</span>
                      <span className="txt">{gm.hasFile ? "📎 FAYL YUBORDI" : gm.text}</span>
                    </div>
                  ))}
                  <div ref={adminMsgEndRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="chat-header">
        <div className="logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          CHAT<span>UZ</span>
          {isAdmin && <ShieldCheck size={14} className="inline ml-1 text-blue-500" />}
        </div>
        <div className="header-info">
          <div className="online-badge">
            <div className="dot"></div>
            {onlineCount} kishi online
          </div>
          <button className="theme-toggle-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="chat-main">
        {partnerConnected ? (
          <div className="partner-info-bar">
            <User size={14} /> <span>Suhbatdosh: <strong>{partnerNickname}</strong></span>
            <button className="next-btn" onClick={nextUser}>KEYINGISI</button>
          </div>
        ) : (
          <div className="search-status">
            {inQueue ? (
              <div className="loader-container">
                <div className="spinner"></div>
                <p>Suhbatdosh qidirilmoqda...</p>
              </div>
            ) : (
              <div className="start-prompt">
                <Play size={48} />
                <p>Salom, <strong>{userData?.nickname}</strong>! Suhbatni boshlang</p>
                <button className="main-start-btn" onClick={toggleChat}>START</button>
              </div>
            )}
          </div>
        )}

        <div className="messages-display scrollbar-hide">
          {messages.map((m, i) => (
            <div key={i} className={`message-wrapper ${m.sender}`}>
              <div className="message-content">
                <span className="nickname-label" style={{ fontSize: '9px', opacity: 0.6, marginBottom: '2px' }}>
                  {m.sender === 'me' ? 'Siz' : m.senderNickname}
                </span>
                {m.text && <p className="text">{m.text}</p>}
                {m.file && (
                  <div className="file-attachment">
                    {m.file.type.startsWith('image/') ? (
                      <img src={m.file.data} alt={m.file.name} className="shared-image" />
                    ) : (
                      <div className="file-info">
                        <FileIcon size={24} />
                        <span className="file-name">{m.file.name}</span>
                      </div>
                    )}
                    <a href={m.file.data} download={m.file.name} className="download-btn">
                      <Download size={16} />
                    </a>
                  </div>
                )}
                <span className="time">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer className="chat-footer">
        <div className="author-tag">Muallif: @secureXXX | Sizning nikingiz: {userData?.nickname}</div>
        <div className="input-area">
          <button className="action-btn" onClick={toggleChat} title={inQueue || partnerConnected ? "To'xtatish" : "Boshlash"}>
            {inQueue || partnerConnected ? <Square size={24} /> : <Play size={24} />}
          </button>
          <div className="input-wrapper">
            <button className="file-btn" onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <input
              type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={partnerConnected ? "Xabar yozing..." : "Suhbatdosh ulanmagan"}
              disabled={!partnerConnected}
            />
            <button className="send-btn" onClick={() => sendMessage()} disabled={!partnerConnected || !inputValue.trim()}><Send size={20} /></button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
