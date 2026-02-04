import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Play, Square, Globe, User, Send, Moon, Sun, Paperclip, File as FileIcon, Download } from 'lucide-react';
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

const App = () => {
  const [userData, setUserData] = useState<{ age: string, country: string } | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerData, setPartnerData] = useState<{ age: string, country: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
      <header className="chat-header">
        <div className="logo">CHAT<span>UZ</span></div>
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
            <Globe size={14} /> <span>{partnerData?.country}</span>
            <span className="separator">|</span>
            <User size={14} /> <span>{partnerData?.age} yosh</span>
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
