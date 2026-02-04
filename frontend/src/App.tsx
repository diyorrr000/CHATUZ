import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Play, Square, User, Send, Moon, Sun, Paperclip, File as FileIcon, Download, ShieldCheck, Activity, Users, Clock, RefreshCw, Eye, Users as UsersIcon, LogOut } from 'lucide-react';
import AgeConfirmation from './components/AgeConfirmation';

const SOCKET_URL = 'https://chatuz-backendd.onrender.com';
const APP_VERSION = "1.0.9";

interface Message {
  text?: string;
  file?: { name: string; type: string; data: string; };
  sender: 'me' | 'partner' | 'system';
  senderNickname?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  timestamp: number;
}

interface AdminData {
  users: any[];
  stats: { total: number; inChat: number; waiting: number; groups: number; };
}

interface AdminGlobalMessage {
  from: string;
  to: string;
  text?: string;
  hasFile: boolean;
  timestamp: number;
}

const App = () => {
  const [userData, setUserData] = useState<{ nickname: string, uid: string } | null>(() => {
    try {
      const saved = localStorage.getItem('chatuz_user');
      let uid = localStorage.getItem('chatuz_uid');
      if (!uid) {
        uid = 'u_v1_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('chatuz_uid', uid);
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.uid) parsed.uid = uid;
        return parsed;
      }
      return null;
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
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLevel, setAdminLevel] = useState<'katta' | 'kichik' | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [globalMessages, setGlobalMessages] = useState<AdminGlobalMessage[]>([]);

  const [currentGroup, setCurrentGroup] = useState<{ roomId: string, name: string } | null>(null);
  const [invitation, setInvitation] = useState<{ roomId: string, roomName: string, inviter: string } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const adminMsgEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const partnerTypingTimeoutRef = useRef<any>(null);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      typedKeys.current += e.key.toLowerCase();
      if (typedKeys.current.includes('admin')) { triggerAdminLogin(); typedKeys.current = ''; }
      if (typedKeys.current.length > 10) typedKeys.current = typedKeys.current.slice(-5);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerAdminLogin]);

  const handleLogoClick = () => {
    logoClicks.current += 1;
    if (logoClicks.current >= 5) { triggerAdminLogin(); logoClicks.current = 0; }
    setTimeout(() => { logoClicks.current = 0; }, 3000);
  };

  const handlePartnerDisconnect = useCallback((data?: { reason: string }) => {
    setPartnerConnected(false);
    setInQueue(true);
    const leaveMsg = data?.reason === 'skipped' ? "Suhbatdosh keyingisiga o'tdi." : "Suhbatdosh tark etdi.";
    setMessages(prev => [...prev, { text: leaveMsg, sender: 'system', timestamp: Date.now() }]);
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], reconnection: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      const uid = localStorage.getItem('chatuz_uid');
      socket.emit('init', { uid });
      if (stateRef.current.userData && (stateRef.current.inQueue || stateRef.current.partnerConnected)) {
        socket.emit('join-queue', stateRef.current.userData);
      }
    });

    socket.on('disconnect', () => setIsConnected(false));
    socket.on('online-count', (count: number) => setOnlineCount(count));
    socket.on('match-found', (data: { partnerNickname: string }) => {
      setInQueue(false); setPartnerConnected(true); setPartnerNickname(data.partnerNickname);
      setMessages([{ text: `Suhbatdosh topildi: ${data.partnerNickname}`, sender: 'system', timestamp: Date.now() }]);
    });
    socket.on('partner-disconnected', handlePartnerDisconnect);
    socket.on('receive-message', (msg: any) => {
      setMessages(prev => [...prev, { ...msg, sender: 'partner' }]);
      setIsPartnerTyping(false);
    });
    socket.on('partner-typing', (isTyping: boolean) => {
      setIsPartnerTyping(isTyping);
      if (partnerTypingTimeoutRef.current) clearTimeout(partnerTypingTimeoutRef.current);
      if (isTyping) partnerTypingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 5000);
    });

    socket.on('admin-auth-success', (data: { level: 'katta' | 'kichik' }) => {
      setIsAdmin(true); setAdminLevel(data.level); setShowAdminPanel(true);
    });
    socket.on('admin-update', (data: AdminData) => setAdminData(data));
    socket.on('admin-new-message', (msg: AdminGlobalMessage) => setGlobalMessages(prev => [...prev, msg].slice(-100)));
    socket.on('admin-revoked', () => { setIsAdmin(false); setAdminLevel(null); setShowAdminPanel(false); alert('Huquqlaringiz olindi.'); });

    socket.on('spy-link-ready', (data: any) => {
      setShowAdminPanel(false); setPartnerConnected(true); setPartnerNickname(`${data.partner1} & ${data.partner2}`);
      setMessages([{ text: `Spy rejimiga ulandingiz: ${data.partner1} vs ${data.partner2}`, sender: 'system', timestamp: Date.now() }]);
    });

    socket.on('group-created', (group: any) => { setCurrentGroup(group); setMessages([]); setShowAdminPanel(false); });
    socket.on('group-joined', (group: any) => { setCurrentGroup(group); setMessages([]); setInQueue(false); setPartnerConnected(false); });
    socket.on('group-invitation', (data: any) => setInvitation(data));
    socket.on('group-message', (msg: any) => {
      setMessages(prev => [...prev, { ...msg, sender: msg.senderNickname === userData?.nickname ? 'me' : 'partner' }]);
    });

    return () => { socket.disconnect(); };
  }, [handlePartnerDisconnect, userData]);

  const startChat = () => {
    if (!userData || !isConnected) return;
    setInQueue(true); setMessages([]); socketRef.current?.emit('join-queue', userData);
  };
  const nextChat = () => {
    if (!isConnected) return;
    setPartnerConnected(false); setInQueue(true); setMessages([]); socketRef.current?.emit('next-user');
  };
  const stopChat = () => {
    setInQueue(false); setPartnerConnected(false); setMessages([]); socketRef.current?.emit('next-user');
  };
  const handleReset = () => { if (confirm('Boshidan boshlaysizmi?')) { localStorage.clear(); window.location.reload(); } };

  const sendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !isConnected) return;
    const isRoom = !!currentGroup;
    if (!isRoom && !partnerConnected) return;

    const msg = { text: inputValue, roomId: currentGroup?.roomId };
    socketRef.current?.emit('send-message', msg);
    socketRef.current?.emit('typing', false);

    if (!isRoom) {
      setMessages(prev => [...prev, {
        text: inputValue, sender: 'me', senderNickname: userData?.nickname,
        isAdmin: isAdmin, isSuperAdmin: adminLevel === 'katta', timestamp: Date.now()
      }]);
    }
    setInputValue('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!partnerConnected || currentGroup) return;
    socketRef.current?.emit('typing', true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socketRef.current?.emit('typing', false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isConnected) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      const fileMsg = { file: { name: file.name, type: file.type, data: base64Data }, roomId: currentGroup?.roomId };
      socketRef.current?.emit('send-message', fileMsg);
      if (!currentGroup) {
        setMessages(prev => [...prev, {
          file: fileMsg.file, sender: 'me', senderNickname: userData?.nickname,
          isAdmin: isAdmin, isSuperAdmin: adminLevel === 'katta', timestamp: Date.now()
        }]);
      }
    };
    reader.readAsDataURL(file);
  };

  const createGroup = () => {
    const name = prompt("Guruh nomini yozing:");
    if (name) socketRef.current?.emit('create-group', name);
  };

  const acceptInvitation = () => {
    if (invitation) { socketRef.current?.emit('join-group', invitation.roomId); setInvitation(null); }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { adminMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [globalMessages]);

  if (!userData) return <AgeConfirmation realOnlineCount={onlineCount} onConfirm={(data) => setUserData(data)} />;

  return (
    <div className="app-container chat-only">
      {invitation && (
        <div className="admin-overlay">
          <div className="admin-modal" style={{ maxWidth: '300px', textAlign: 'center', padding: '20px' }}>
            <h3>Guruhga taklif</h3>
            <p><strong>{invitation.inviter}</strong> sizni <strong>{invitation.roomName}</strong> guruhiga taklif qildi.</p>
            <div className="flex gap-2 justify-center mt-4">
              <button className="grant-btn" onClick={acceptInvitation}>Kirish</button>
              <button className="revoke-btn" onClick={() => setInvitation(null)}>Rad etish</button>
            </div>
          </div>
        </div>
      )}

      {showAdminPanel && isAdmin && (
        <div className="admin-overlay">
          <div className="admin-modal wide">
            <div className="admin-header">
              <div className="flex items-center gap-2">
                <ShieldCheck className={adminLevel === 'katta' ? "text-yellow-500" : "text-blue-500"} />
                <h2>{adminLevel === 'katta' ? "Katta Admin Panel" : "Kichik Admin Panel"}</h2>
              </div>
              <div className="flex gap-2">
                <button className="grant-btn flex items-center gap-1" onClick={createGroup}><UsersIcon size={14} /> Guruh ochish</button>
                <button className="close-admin" onClick={() => setShowAdminPanel(false)}>Yopish</button>
              </div>
            </div>
            <div className="admin-stats">
              <div className="stat-card"><Users size={20} /><div className="val">{adminData?.stats.total}</div><div className="lab">Jami</div></div>
              <div className="stat-card"><Activity size={20} /><div className="val">{adminData?.stats.inChat}</div><div className="lab">Chatda</div></div>
              <div className="stat-card"><Clock size={20} /><div className="val">{adminData?.stats.waiting}</div><div className="lab">Kutmoqda</div></div>
              <div className="stat-card"><UsersIcon size={20} /><div className="val">{adminData?.stats.groups}</div><div className="lab">Guruhlar</div></div>
            </div>
            <div className="admin-content-grid">
              <div className="admin-user-list scrollbar-hide">
                <table>
                  <thead><tr><th>NIK</th><th>ROL</th><th>AMAL</th></tr></thead>
                  <tbody>
                    {adminData?.users.map((u, i) => (
                      <tr key={i}>
                        <td className="text-sm">{u.nickname}</td>
                        <td>
                          {u.isSuperAdmin ? <span className="admin-badge katta">Katta Admin</span> :
                            u.isKichikAdmin ? <span className="admin-badge">Kichik Admin</span> : <span className="text-xs opacity-50">User</span>}
                        </td>
                        <td className="flex gap-1 flex-wrap">
                          {u.id !== socketRef.current?.id && adminLevel === 'katta' && (
                            u.isKichikAdmin ? (
                              <button onClick={() => socketRef.current?.emit('revoke-admin', u.id)} className="revoke-btn text-[9px]">Olish</button>
                            ) : !u.isSuperAdmin && (
                              <button onClick={() => socketRef.current?.emit('grant-admin', u.id)} className="grant-btn text-[9px]">Admin qilish</button>
                            )
                          )}
                          {u.chatPartnerId && adminLevel === 'katta' && (
                            <button onClick={() => socketRef.current?.emit('spy-chat', u.id)} className="action-btn-sm" title="Chatga ulanish"><Eye size={12} /></button>
                          )}
                          {currentGroup && (
                            <button onClick={() => socketRef.current?.emit('invite-user', { roomId: currentGroup.roomId, targetId: u.id })} className="grant-btn text-[9px]">Taklif</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-global-chat" style={{ overflowY: 'auto' }}>
                <div className="admin-messages">
                  {adminLevel === 'katta' ? globalMessages.map((gm, i) => (
                    <div key={i} className="admin-msg-row">
                      <span className="ids">[{gm.from} → {gm.to}]</span>
                      <span className="txt">{gm.hasFile ? "📎 FAYL" : gm.text}</span>
                    </div>
                  )) : <p className="p-4 opacity-50 italic">Faqat Katta Adminlar suhbatlarni ko'ra oladilar.</p>}
                  <div ref={adminMsgEndRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="chat-header">
        <div className="logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          CHAT<span>UZ</span> {adminLevel === 'katta' && <ShieldCheck size={14} className="inline ml-1 text-yellow-500" />}
          {adminLevel === 'kichik' && <ShieldCheck size={14} className="inline ml-1 text-blue-500" />}
        </div>
        <div className="header-info">
          {currentGroup && <div className="online-badge" style={{ background: '#3b82f6' }}>{currentGroup.name}</div>}
          <div className="online-badge"><div className="dot"></div>{onlineCount} kishi</div>
          {currentGroup && <button className="theme-toggle-btn" onClick={() => { setCurrentGroup(null); setMessages([]); }}><LogOut size={20} /></button>}
          <button className="theme-toggle-btn" onClick={handleReset}><RefreshCw size={20} /></button>
          <button className="theme-toggle-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="chat-main">
        {partnerConnected || currentGroup ? (
          <div className="partner-info-bar">
            {currentGroup ? <UsersIcon size={14} /> : <User size={14} />}
            <span> {currentGroup ? currentGroup.name : `Suhbatdosh: ${partnerNickname}`}</span>
            {!currentGroup && <button className="next-btn" onClick={nextChat}>KEYINGISI</button>}
          </div>
        ) : (
          <div className="search-status">
            {inQueue ? (
              <div className="loader-container"><div className="spinner"></div><p>Qidirilmoqda...</p>
                <button className="skip-btn" onClick={stopChat} style={{ marginTop: '10px' }}>TO'XTATISH</button>
              </div>
            ) : (
              <div className="start-prompt"><Play size={48} /><p>Salom, <strong>{userData.nickname}</strong></p>
                <button className="main-start-btn" onClick={startChat}>CHATNI BOSHLASH</button>
              </div>
            )}
          </div>
        )}

        <div className="messages-display scrollbar-hide">
          {messages.map((m, i) => (
            <div key={i} className={`message-wrapper ${m.sender} ${m.isSuperAdmin ? 'admin-msg super-admin' : m.isAdmin ? 'admin-msg' : ''}`}>
              <div className="message-content">
                <span className="nickname-label">
                  {m.isSuperAdmin && <ShieldCheck size={10} className="inline mr-1 text-yellow-500" />}
                  {m.isAdmin && !m.isSuperAdmin && <ShieldCheck size={10} className="inline mr-1 text-blue-500" />}
                  {m.sender === 'me' ? 'Siz' : m.senderNickname}
                  {m.isSuperAdmin && <span className="admin-badge katta">KAT_ADMIN</span>}
                  {m.isAdmin && !m.isSuperAdmin && <span className="admin-badge">KCH_ADMIN</span>}
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
          {isPartnerTyping && !currentGroup && (
            <div className="message-wrapper partner"><div className="message-content typing-indicator">
              <span className="nickname-label" style={{ fontSize: '9px', opacity: 0.6 }}>yozmoqda...</span>
              <div className="typing-dots"><span></span><span></span><span></span></div>
            </div></div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer className="chat-footer">
        <div className="author-tag">@secureXXX | v{APP_VERSION}</div>
        <div className="input-area">
          <button className="action-btn" onClick={partnerConnected ? nextChat : startChat}>
            {inQueue || partnerConnected ? <Square size={24} /> : <Play size={24} />}
          </button>
          <div className="input-wrapper">
            <button className="file-btn" onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <input type="text" value={inputValue} onChange={handleInputChange} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Xabar..." disabled={!partnerConnected && !currentGroup} />
            <button className="send-btn" onClick={() => sendMessage()} disabled={(!partnerConnected && !currentGroup) || !inputValue.trim()}><Send size={20} /></button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
