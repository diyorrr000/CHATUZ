import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Camera, CameraOff, Mic, MicOff, SkipForward, Play, Square, Globe, User, Send, AlertCircle, Moon, Sun } from 'lucide-react';
import AgeConfirmation from './components/AgeConfirmation';

const SOCKET_URL = 'https://chatuz-backend.onrender.com';

const App = () => {
  const [userData, setUserData] = useState<{ age: string, country: string } | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerData, setPartnerData] = useState<{ age: string, country: string } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [messages, setMessages] = useState<{ text: string, sender: 'me' | 'partner' }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ]
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('online-count', (count: number) => {
      setOnlineCount(count);
    });

    socketRef.current.on('match-found', async ({ partnerId, initiator, partnerInfo }) => {
      setInQueue(false);
      setPartnerConnected(true);
      setPartnerData(partnerInfo);
      setMessages([]);

      const pc = createPeerConnection(partnerId);

      if (initiator) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('signal', { type: 'offer', sdp: offer, to: partnerId });
        } catch (err) {
          console.error('Failed to create offer:', err);
        }
      }
    });

    socketRef.current.on('signal', async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        if (data.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          // Process any candidates that arrived before the offer
          while (pendingCandidates.current.length > 0) {
            const candidate = pendingCandidates.current.shift();
            if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current?.emit('signal', { type: 'answer', sdp: answer, to: data.from });
        } else if (data.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          // Process any candidates that arrived before the answer
          while (pendingCandidates.current.length > 0) {
            const candidate = pendingCandidates.current.shift();
            if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } else if (data.type === 'candidate' && data.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            pendingCandidates.current.push(data.candidate);
          }
        }
      } catch (err) {
        console.error('Signaling error:', err);
      }
    });

    socketRef.current.on('partner-disconnected', () => {
      resetPeerConnection();
      setPartnerConnected(false);
      setPartnerData(null);
      setInQueue(true);
    });

    socketRef.current.on('receive-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (userData) {
      initMedia();
    }
  }, [userData]);

  const initMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      console.error('Media error:', err);
      alert('Kamera yoki mikrofonga ruxsat berilmagan. Iltimos, brauzer sozlamalarini tekshiring.');
    }
  };

  const createPeerConnection = (partnerId: string) => {
    resetPeerConnection();
    pendingCandidates.current = [];

    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('signal', { type: 'candidate', candidate: event.candidate, to: partnerId });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.warn('WebRTC failed. This is likely due to NAT firewall blocks on mobile data.');
      }
    };

    return pc;
  };

  const resetPeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    pendingCandidates.current = [];
  };

  const toggleChat = () => {
    if (!inQueue && !partnerConnected) {
      setInQueue(true);
      socketRef.current?.emit('join-queue', userData);
    } else {
      setInQueue(false);
      resetPeerConnection();
      setPartnerConnected(false);
      setPartnerData(null);
      socketRef.current?.emit('next-user');
    }
  };

  const nextUser = () => {
    if (!inQueue && !partnerConnected) return;
    resetPeerConnection();
    setPartnerConnected(false);
    setPartnerData(null);
    setMessages([]);
    setInQueue(true);
    socketRef.current?.emit('next-user');
  };

  const toggleCam = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setCamOn(videoTrack.enabled);
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !partnerConnected) return;
    socketRef.current?.emit('send-message', inputValue);
    setMessages(prev => [...prev, { text: inputValue, sender: 'me' }]);
    setInputValue('');
  };

  if (!userData) {
    return <AgeConfirmation realOnlineCount={onlineCount} onConfirm={(data) => setUserData(data)} />;
  }

  return (
    <div className="app-container">
      <div className="video-section">
        <div className="video-box">
          <div className="badge">SIZ</div>
          <video ref={localVideoRef} autoPlay muted playsInline className="mirror" />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
              <CameraOff size={64} className="text-white/20" />
            </div>
          )}
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={toggleMic} className={`p-2 rounded-lg ${micOn ? 'bg-white/10' : 'bg-red-500/80'} backdrop-blur-md border border-white/10`}>
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <button onClick={toggleCam} className={`p-2 rounded-lg ${camOn ? 'bg-white/10' : 'bg-red-500/80'} backdrop-blur-md border border-white/10`}>
              {camOn ? <Camera size={18} /> : <CameraOff size={18} />}
            </button>
          </div>
        </div>

        <div className="video-box">
          <div className="badge">{partnerConnected ? "SUHBATDOSH" : "QIDIRILMOQDA..."}</div>
          {partnerConnected ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline />
              <div className="absolute bottom-4 left-4 glass px-3 py-1 text-[10px] flex gap-3 text-white">
                <span className="flex items-center gap-1"><Globe size={12} /> {partnerData?.country}</span>
                <span className="flex items-center gap-1"><User size={12} /> {partnerData?.age} yosh</span>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-gray-900/40">
              {inQueue ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-blue-400 font-bold tracking-widest text-[10px]">QIDIRILMOQDA...</span>
                </div>
              ) : (
                <div className="text-center opacity-30">
                  <Play size={60} />
                  <p className="mt-4 font-bold uppercase tracking-widest text-[10px]">BOSHLASHNI BOSING</p>
                </div>
              )}
            </div>
          )}
          {partnerConnected && (
            <button
              onClick={() => { socketRef.current?.emit('report-user'); nextUser(); }}
              className="absolute top-4 right-4 p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg border border-red-500/30 text-red-500"
            >
              <AlertCircle size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="bottom-panel">
        <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={20} color="#facc15" /> : <Moon size={20} color="#3b82f6" />}
        </button>

        <div className="controls-group">
          <div onClick={toggleChat} className={`control-item ${(inQueue || partnerConnected) ? 'active' : ''}`}>
            {(inQueue || partnerConnected) ? <Square size={28} /> : <Play size={28} fill="currentColor" />}
            <span>{(inQueue || partnerConnected) ? "Stop" : "Start"}</span>
          </div>

          <div onClick={nextUser} className={`control-item ${(!inQueue && !partnerConnected) ? 'disabled' : ''}`}>
            <SkipForward size={28} fill="currentColor" />
            <span>Keyingi</span>
          </div>

          <div className="control-item active hidden md:flex">
            <Globe size={28} />
            <span>{userData.country.split(' (')[0]}</span>
          </div>
        </div>

        <div className="chat-container">
          <div className="chat-messages scrollbar-hide">
            {messages.length === 0 && <p className="text-center opacity-20 mt-4">Xabarlar yo'q...</p>}
            {messages.map((m, i) => (
              <div key={i} style={{ textAlign: m.sender === 'me' ? 'right' : 'left', marginBottom: '4px' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: '10px',
                  backgroundColor: m.sender === 'me' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                  color: 'white'
                }}>
                  {m.text}
                </span>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="chat-form">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Xabar..."
            />
            <button type="submit" style={{ background: 'transparent', border: 'none', color: '#3b82f6', padding: '0 10px', cursor: 'pointer' }}>
              <Send size={18} />
            </button>
          </form>
        </div>

        <div className="dev-credit">YARATUVCHI: SHONAZAROV DIYORBEK</div>
      </div>
    </div>
  );
};

export default App;
