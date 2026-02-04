import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Play, Square, User, Send, Moon, Sun, Paperclip, File as FileIcon, Download, ShieldCheck, Activity, Users, Clock, RefreshCw } from 'lucide-react';
import AgeConfirmation from './components/AgeConfirmation';

const SOCKET_URL = 'https://chatuz-backendd.onrender.com';
const APP_VERSION = "1.0.8"; // To track if update is live

interface Message {
  text?: string;
  file?: { name: string; type: string; data: string; };
  sender: 'me' | 'partner';
  senderNickname?: string;
  isAdmin?: boolean;
  timestamp: number;
}

interface AdminData {
  users: any[];
  stats: { total: number; inChat: number; waiting: number; };
}

interface AdminGlobalMessage {
  from: string;
  to: string;
  text?: string;
  hasFile: boolean;
  timestamp: number;
}

const App = () => {
  const [userData, setUserData] = useState<{ nickname: string } | null>(() => {
    try {
      const saved = localStorage.getItem('chatuz_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [inQueue, setInQueue] = useState(false);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerNickname, setPartnerNickname] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isConnected, setIsConnected] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [globalMessages, setGlobalMessages] = useState<AdminGlobalMessage[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const adminMsgEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin triggers state
  const typedKeys = useRef<string>('');
  const logoClicks = useRef<number>(0);

  const stateRef = useRef({ userData, inQueue, partnerConnected });
  useEffect(() => { stateRef.current = { userData, inQueue, partnerConnected }; }, [userData, inQueue, partnerConnected]);

  useEffect(() => {
    if (userData) localStorage.setItem('chatuz_user', JSON.stringify(userData));
  }, [userData]);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const triggerAdminLogin = useCallback(() => {
    const pass = prompt('Admin paroli:');
    if (pass === '1212') {
      socketRef.current?.emit('admin-login', pass);
    } else if (pass !== null) {
      alert('Noto\'g\'ri parol!');
    }
  }, []);

  // Admin access listeners
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
  }, [triggerAdminLogin]);

  const handleLogoClick = () => {
    logoClicks.current += 1;
    if (logoClicks.current >= 5) {
      triggerAdminLogin();
      logoClicks.current = 0;
    }
    setTimeout(() => { logoClicks.current = 0; }, 3000);
  };

  const handlePartnerDisconnect = useCallback((data?: { reason: string }) => {
    setPartnerConnected(false);
    setInQueue(true);
    const leaveMsg = data?.reason === 'skipped'
      ? "Suhbatdosh 'Keyingisi'ni bosdi. Yangi qidirilmoqda..."
      : "Suhbatdosh tark etdi. Yangi qidirilmoqda...";
    setMessages(prev => [...prev, { text: leaveMsg, sender: 'partner', timestamp: Date.now() }]);
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], reconnection: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      if (stateRef.current.userData && (stateRef.current.inQueue || stateRef.current.partnerConnected)) {
        socket.emit('join-queue', stateRef.current.userData);
      }
    });

    socket.on('disconnect', () => setIsConnected(false));
    socket.on('online-count', (count: number) => setOnlineCount(count));

    socket.on('match-found', (data: { partnerNickname: string }) => {
      setInQueue(false);
      setPartnerConnected(true);
      setPartnerNickname(data.partnerNickname);
      setMessages(prev => [...prev, {
        text: `Suhbatdosh topildi: ${data.partnerNickname}! Salom deng 😊`,
        sender: 'partner', senderNickname: data.partnerNickname, timestamp: Date.now()
      }]);
    });

    socket.on('partner-disconnected', handlePartnerDisconnect);
    socket.on('receive-message', (msg: any) => setMessages(prev => [...prev, { ...msg, sender: 'partner' }]));

    socket.on('admin-auth-success', () => {
      setIsAdmin(true);
      setShowAdminPanel(true);
      alert('Admin muvaffaqiyatli kirdi!');
    });

    socket.on('admin-update', (data: AdminData) => setAdminData(data));
    socket.on('admin-new-message', (msg: AdminGlobalMessage) => {
      setGlobalMessages(prev => [...prev, msg].slice(-100));
    });

    return () => { socket.disconnect(); };
  }, [handlePartnerDisconnect]);

  const startChat = () => {
    if (!userData || !isConnected) return;
    setInQueue(true); setMessages([]);
    socketRef.current?.emit('join-queue', userData);
  };

  const nextChat = () => {
    if (!isConnected) return;
    setPartnerConnected(false); setInQueue(true); setMessages([]);
    socketRef.current?.emit('next-user');
  };

  const stopChat = () => {
    setInQueue(false); setPartnerConnected(false); setMessages([]);
    socketRef.current?.emit('next-user');
  };

  const handleReset = () => {
    if (confirm('Boshidan boshlaysizmi?')) {
      localStorage.removeItem('chatuz_user');
      window.location.reload();
    }
  };

  const sendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !partnerConnected || !isConnected) return;
    const msg = { text: inputValue };
    socketRef.current?.emit('send-message', msg);
    setMessages(prev => [...prev, {
      text: inputValue,
      sender: 'me',
      senderNickname: userData?.nickname,
      isAdmin: isAdmin,
      timestamp: Date.now()
    }]);
    setInputValue('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !partnerConnected || !isConnected) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      const fileMsg = { file: { name: file.name, type: file.type, data: base64Data } };
      socketRef.current?.emit('send-message', fileMsg);
      setMessages(prev => [...prev, {
        file: fileMsg.file,
        sender: 'me',
        senderNickname: userData?.nickname,
        isAdmin: isAdmin,
        timestamp: Date.now()
      }]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { adminMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [globalMessages]);

  if (!userData) return <AgeConfirmation realOnlineCount={onlineCount} onConfirm={(data) => setUserData(data)} />;

  return (
    <div className="app-container chat-only">
      {showAdminPanel && isAdmin && (
        <div className="admin-overlay">
          <div className="admin-modal wide">
            <div className="admin-header">
              <div className="flex items-center gap-2"><ShieldCheck className="text-blue-500" /><h2>Admin Panel</h2></div>
              <button className="close-admin" onClick={() => setShowAdminPanel(false)}>Yopish</button>
            </div>
            <div className="admin-stats">
              <div className="stat-card"><Users size={20} /><div className="val">{adminData?.stats.total || 0}</div><div className="lab">Jami</div></div>
              <div className="stat-card"><Activity size={20} /><div className="val">{adminData?.stats.inChat || 0}</div><div className="lab">Chatda</div></div>
              <div className="stat-card"><Clock size={20} /><div className="val">{adminData?.stats.waiting || 0}</div><div className="lab">Kutmoqda</div></div>
            </div>
            <div className="admin-content-grid">
              <div className="admin-user-list scrollbar-hide">
                <table>
                  <thead><tr><th>NIK</th><th>STATUS</th></tr></thead>
                  <tbody>
                    {adminData?.users.map((u, i) => (
                      <tr key={i}><td>{u.nickname}</td><td>{u.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-global-chat scrollbar-hide">
                <div className="admin-messages">
                  {globalMessages.map((gm, i) => (
                    <div key={i} className="admin-msg-row">
                      <span className="ids">[{gm.from} → {gm.to}]</span>
                      <span className="txt">{gm.hasFile ? "📎 FAYL" : gm.text}</span>
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
          CHAT<span>UZ</span> {isAdmin && <ShieldCheck size={14} className="inline ml-1 text-blue-500" />}
        </div>
        <div className="header-info">
          {!isConnected && <div className="online-badge" style={{ background: '#ef4444' }}>Bog'lanish...</div>}
          <div className="online-badge"><div className="dot"></div>{onlineCount} kishi</div>
          <button className="theme-toggle-btn" onClick={handleReset} title="Reset"><RefreshCw size={20} /></button>
          <button className="theme-toggle-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="chat-main">
        {partnerConnected ? (
          <div className="partner-info-bar">
            <User size={14} /> <span>Suhbatdosh: <strong>{partnerNickname}</strong></span>
            <button className="next-btn" onClick={nextChat}>KEYINGISI</button>
          </div>
        ) : (
          <div className="search-status">
            {inQueue ? (
              <div className="loader-container">
                <div className="spinner"></div><p>Siz navbatdasiz...</p>
                <button className="skip-btn" onClick={stopChat} style={{ marginTop: '20px' }}>TO'XTATISH</button>
              </div>
            ) : (
              <div className="start-prompt">
                <Play size={48} /><p>Salom, <strong>{userData.nickname}</strong></p>
                <button className="main-start-btn" onClick={startChat}>CHATNI BOSHLASH</button>
              </div>
            )}
          </div>
        )}

        <div className="messages-display scrollbar-hide">
          {messages.map((m, i) => (
            <div key={i} className={`message-wrapper ${m.sender} ${m.isAdmin ? 'admin-msg' : ''}`}>
              <div className="message-content">
                <span className="nickname-label">
                  {m.isAdmin && <ShieldCheck size={10} className="inline mr-1 text-yellow-500" />}
                  {m.sender === 'me' ? 'Siz' : m.senderNickname}
                  {m.isAdmin && <span className="admin-badge">ADMIN</span>}
                </span>
                {m.text && <p className="text">{m.text}</p>}
                {m.file && (
                  <div className="file-attachment">
                    <img src={m.file.data} alt="file" className="shared-image" />
                    <a href={m.file.data} download={m.file.name} className="download-btn"><Download size={16} /></a>
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
        <div className="author-tag">@secureXXX | {userData.nickname} | v{APP_VERSION}</div>
        <div className="input-area">
          <button className="action-btn" onClick={partnerConnected ? nextChat : startChat}>
            {inQueue || partnerConnected ? <Square size={24} /> : <Play size={24} />}
          </button>
          <div className="input-wrapper">
            <button className="file-btn" onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Xabar..." disabled={!partnerConnected} />
            <button className="send-btn" onClick={() => sendMessage()} disabled={!partnerConnected || !inputValue.trim()}><Send size={20} /></button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
