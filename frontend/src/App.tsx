import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Play, Square, User, Send, Moon, Sun, Paperclip, File as FileIcon, Download, ShieldCheck, Activity, Users, Clock } from 'lucide-react';
import AgeConfirmation from './components/AgeConfirmation';

const SOCKET_URL = 'https://chatuz-backendd.onrender.com';

interface Message {
  text?: string;
  file?: { name: string; type: string; data: string; };
  sender: 'me' | 'partner';
  senderNickname?: string;
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
  // Persistence for nickname
  const [userData, setUserData] = useState<{ nickname: string } | null>(() => {
    const saved = localStorage.getItem('chatuz_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [inQueue, setInQueue] = useState(false);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerNickname, setPartnerNickname] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [globalMessages, setGlobalMessages] = useState<AdminGlobalMessage[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const adminMsgEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update local storage when userData changes
  useEffect(() => {
    if (userData) localStorage.setItem('chatuz_user', JSON.stringify(userData));
  }, [userData]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Socket Connection
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('online-count', (count: number) => setOnlineCount(count));

    socket.on('match-found', (data: { partnerNickname: string }) => {
      setInQueue(false);
      setPartnerConnected(true);
      setPartnerNickname(data.partnerNickname);
      setMessages([{
        text: `Suhbatdosh topildi: ${data.partnerNickname}! 😊`,
        sender: 'partner',
        senderNickname: data.partnerNickname,
        timestamp: Date.now()
      }]);
    });

    socket.on('partner-disconnected', (data?: { reason: string }) => {
      setPartnerConnected(false);
      setInQueue(true); // Server will put us back in queue, but we update UI
      const leaveMsg = data?.reason === 'skipped'
        ? "Suhbatdosh tark etdi (Keyingisi). Yangi qidirilmoqda..."
        : "Suhbatdosh tark etdi. Yangi qidirilmoqda...";
      setMessages(prev => [...prev, { text: leaveMsg, sender: 'partner', timestamp: Date.now() }]);
    });

    socket.on('receive-message', (msg: any) => {
      setMessages(prev => [...prev, { ...msg, sender: 'partner' }]);
    });

    socket.on('admin-auth-success', () => {
      setIsAdmin(true);
      setShowAdminPanel(true);
    });

    socket.on('admin-update', (data: AdminData) => setAdminData(data));
    socket.on('admin-new-message', (msg: AdminGlobalMessage) => {
      setGlobalMessages(prev => [...prev, msg].slice(-100));
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { adminMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [globalMessages]);

  const startChat = () => {
    if (!userData) return;
    setInQueue(true);
    setMessages([]);
    socketRef.current?.emit('join-queue', userData);
  };

  const nextChat = () => {
    setPartnerConnected(false);
    setInQueue(true);
    setMessages([]);
    socketRef.current?.emit('next-user');
  };

  const skipOrStop = () => {
    setInQueue(false);
    setPartnerConnected(false);
    setMessages([]);
    socketRef.current?.emit('next-user'); // Server will put us back, we need a 'stop' really
  };

  const sendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !partnerConnected) return;
    const msg = { text: inputValue };
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
      const fileMsg = { file: { name: file.name, type: file.type, data: base64Data } };
      socketRef.current?.emit('send-message', fileMsg);
      setMessages(prev => [...prev, { file: fileMsg.file, sender: 'me', senderNickname: userData?.nickname, timestamp: Date.now() }]);
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
            {/* Admin UI remains same as it was working */}
            <div className="admin-header">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-blue-500" />
                <h2 style={{ color: 'white' }}>Live Monitoring</h2>
              </div>
              <button className="close-admin" onClick={() => setShowAdminPanel(false)}>Yopish</button>
            </div>
            <div className="admin-content-grid">
              <div className="admin-user-list scrollbar-hide">
                <table>
                  <thead><tr><th>NIK</th><th>STATUS</th></tr></thead>
                  <tbody>
                    {adminData?.users.map((u, i) => (
                      <tr key={i}>
                        <td className="font-bold text-blue-300">{u.nickname}</td>
                        <td><span className={`status-pill ${u.status === 'Chatda' ? 'bg-green-500' : 'bg-blue-500'}`}>{u.status}</span></td>
                      </tr>
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
        <div className="logo" onClick={() => {
          const pass = prompt('Admin paroli:');
          if (pass === '1212') socketRef.current?.emit('admin-login', pass);
        }} style={{ cursor: 'pointer' }}>
          CHAT<span>UZ</span>
        </div>
        <div className="header-info">
          <div className="online-badge"><div className="dot"></div>{onlineCount} online</div>
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
                <div className="spinner"></div>
                <p>Siz navbatdasiz... Qidirilmoqda...</p>
                <button className="skip-btn" onClick={skipOrStop} style={{ marginTop: '20px', background: 'rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '10px' }}>TO'XTATISH</button>
              </div>
            ) : (
              <div className="start-prompt">
                <Play size={48} />
                <p>Nikingiz: <strong>{userData.nickname}</strong></p>
                <button className="main-start-btn" onClick={startChat}>START</button>
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
                      <div className="file-info"><FileIcon size={24} /><span className="file-name">{m.file.name}</span></div>
                    )}
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
        <div className="author-tag">@secureXXX | {userData.nickname}</div>
        <div className="input-area">
          <button className="action-btn" onClick={partnerConnected ? nextChat : startChat}>
            {inQueue || partnerConnected ? <Square size={24} /> : <Play size={24} />}
          </button>
          <div className="input-wrapper">
            <button className="file-btn" onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <input
              type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={partnerConnected ? "Xabar..." : "Ulanmagan"}
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
