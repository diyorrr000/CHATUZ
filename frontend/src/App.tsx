import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Play, Square, Globe, User, Send, Moon, Sun, Paperclip, File as FileIcon, Download, ShieldCheck, Activity, Users, Clock, Globe2 } from 'lucide-react';
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

const App = () => {
  const [userData, setUserData] = useState<{ age: string, country: string } | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerData, setPartnerData] = useState<{ age: string, country: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Admin states
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const typedKeys = useRef<string>('');

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      typedKeys.current += e.key.toLowerCase();
      if (typedKeys.current.endsWith('admin')) {
        const pass = prompt('Admin paroli:');
        if (pass === '1212') {
          socketRef.current?.emit('admin-login', pass);
        } else if (pass !== null) {
          alert('Noto\'g\'ri parol!');
        }
        typedKeys.current = '';
      }
      if (typedKeys.current.length > 20) typedKeys.current = typedKeys.current.slice(-10);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('online-count', (count: number) => setOnlineCount(count));

    socket.on('match-found', ({ partnerInfo }) => {
      setInQueue(false);
      setPartnerConnected(true);
      setPartnerData(partnerInfo);
      setMessages([{
        text: "Suhbatdosh topildi! Salom deng 😊",
        sender: 'partner',
        timestamp: Date.now()
      }]);
    });

    socket.on('partner-disconnected', (data?: { reason: string }) => {
      setPartnerConnected(false);
      setPartnerData(null);
      setInQueue(true);
      socketRef.current?.emit('join-queue', userData);

      const leaveMessage = data?.reason === 'skipped'
        ? "Suhbatdosh 'Keyingisi' tugmasini bosdi. Yangi suhbatdosh qidirilmoqda..."
        : "Suhbatdosh tark etdi. Yangi suhbatdosh qidirilmoqda...";

      setMessages(prev => [...prev, {
        text: leaveMessage,
        sender: 'partner',
        timestamp: Date.now()
      }]);
    });

    socket.on('receive-message', (msg: any) => {
      setMessages(prev => [...prev, { ...msg, sender: 'partner', timestamp: Date.now() }]);
    });

    // Admin listeners
    socket.on('admin-auth-success', () => {
      setIsAdmin(true);
      setShowAdminPanel(true);
    });

    socket.on('admin-update', (data: AdminData) => {
      setAdminData(data);
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
      setPartnerData(null);
      socketRef.current?.emit('next-user');
    }
  };

  const nextUser = () => {
    setPartnerConnected(false);
    setPartnerData(null);
    setMessages([]);
    setInQueue(true);
    socketRef.current?.emit('next-user');
  };

  const sendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !partnerConnected) return;

    const msg: Partial<Message> = { text: inputValue };
    socketRef.current?.emit('send-message', msg);
    setMessages(prev => [...prev, { text: inputValue, sender: 'me', timestamp: Date.now() }]);
    setInputValue('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !partnerConnected) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      const fileMsg: Partial<Message> = {
        file: {
          name: file.name,
          type: file.type,
          data: base64Data
        }
      };
      socketRef.current?.emit('send-message', fileMsg);
      setMessages(prev => [...prev, {
        file: {
          name: file.name,
          type: file.type,
          data: base64Data
        },
        sender: 'me',
        timestamp: Date.now()
      }]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!userData) {
    return <AgeConfirmation realOnlineCount={onlineCount} onConfirm={(data) => setUserData(data)} />;
  }

  return (
    <div className="app-container chat-only">
      {/* Admin Panel Modal */}
      {showAdminPanel && isAdmin && (
        <div className="admin-overlay">
          <div className="admin-modal">
            <div className="admin-header">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-blue-500" />
                <h2>Boshqaruv Paneli</h2>
              </div>
              <Activity className="text-blue-500 animate-pulse" />
              <button className="close-admin" onClick={() => setShowAdminPanel(false)}>Yopish</button>
            </div>

            <div className="admin-stats">
              <div className="stat-card">
                <Users size={20} />
                <div className="val">{adminData?.stats.total || 0}</div>
                <div className="lab">Jami foydalanuvchi</div>
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

            <div className="admin-user-list">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>IP Manzil</th>
                    <th>Hudud</th>
                    <th>Yosh</th>
                    <th>Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {adminData?.users.map((u, i) => (
                    <tr key={i} className={u.id === socketRef.current?.id ? 'is-me' : ''}>
                      <td className="font-mono text-[10px]">{u.id.slice(0, 8)}...</td>
                      <td className="font-mono text-[11px] text-blue-400">{u.ip}</td>
                      <td>{u.country}</td>
                      <td>{u.age}</td>
                      <td>
                        <span className={`status-pill ${u.status === 'Chatda' ? 'bg-green-500' : 'bg-blue-500'}`}>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <header className="chat-header">
        <div className="logo" onClick={() => isAdmin && setShowAdminPanel(true)} style={{ cursor: isAdmin ? 'pointer' : 'default' }}>
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
            <User size={14} /> <span>Suhbatdosh ulandi (Global)</span>
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
                <p>Suhbatni boshlash uchun START tugmasini bosing</p>
                <button className="main-start-btn" onClick={toggleChat}>START</button>
              </div>
            )}
          </div>
        )}

        <div className="messages-display">
          {messages.map((m, i) => (
            <div key={i} className={`message-wrapper ${m.sender}`}>
              <div className="message-content">
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
        <div className="input-area">
          <button className="action-btn" onClick={toggleChat} title={inQueue || partnerConnected ? "To'xtatish" : "Boshlash"}>
            {inQueue || partnerConnected ? <Square size={24} /> : <Play size={24} />}
          </button>

          <div className="input-wrapper">
            <button className="file-btn" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={20} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={partnerConnected ? "Xabar yozing..." : "Suhbatdosh ulanmagan"}
              disabled={!partnerConnected}
            />
            <button className="send-btn" onClick={() => sendMessage()} disabled={!partnerConnected || !inputValue.trim()}>
              <Send size={20} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
