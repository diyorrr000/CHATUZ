import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Camera, CameraOff, Mic, MicOff, SkipForward, AlertTriangle, MessageSquare, Send, Globe, User, PhoneOff } from 'lucide-react';
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

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  useEffect(() => {
    if (userData) {
      initSocket();
      initMedia();
    }
    return () => {
      socketRef.current?.disconnect();
      localStream?.getTracks().forEach(track => track.stop());
    };
  }, [userData]);

  const initSocket = () => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('match-found', async ({ partnerId, initiator, partnerInfo }) => {
      setInQueue(false);
      setPartnerConnected(true);
      setPartnerData(partnerInfo);
      setMessages([]);

      createPeerConnection(partnerId);

      if (initiator) {
        const offer = await peerConnectionRef.current?.createOffer();
        await peerConnectionRef.current?.setLocalDescription(offer);
        socketRef.current?.emit('signal', { type: 'offer', sdp: offer, to: partnerId });
      }
    });

    socketRef.current.on('signal', async (data) => {
      if (!peerConnectionRef.current) return;
      if (data.type === 'offer') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socketRef.current?.emit('signal', { type: 'answer', sdp: answer, to: data.from });
      } else if (data.type === 'answer') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === 'candidate' && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error(e);
        }
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
  };

  const initMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      alert('Kamera va mikrofonga ruxsat berilishi shart!');
    }
  };

  const createPeerConnection = (partnerId: string) => {
    resetPeerConnection();
    peerConnectionRef.current = new RTCPeerConnection(configuration);
    localStream?.getTracks().forEach(track => peerConnectionRef.current?.addTrack(track, localStream));
    peerConnectionRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('signal', { type: 'candidate', candidate: event.candidate, to: partnerId });
      }
    };
  };

  const resetPeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const startChat = () => {
    setInQueue(true);
    socketRef.current?.emit('join-queue', userData);
  };

  const nextUser = () => {
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

  const reportUser = () => {
    socketRef.current?.emit('report-user');
    nextUser();
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    socketRef.current?.emit('send-message', inputValue);
    setMessages(prev => [...prev, { text: inputValue, sender: 'me' }]);
    setInputValue('');
  };

  if (!userData) {
    return <AgeConfirmation onConfirm={(data) => setUserData(data)} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden text-white font-sans">
      {/* Video Content Area */}
      <div className="flex-1 relative flex flex-col p-4 gap-4">
        {/* Top Floating Header */}
        <div className="absolute top-8 left-8 right-8 z-20 flex justify-between items-center bg-black/20 backdrop-blur-xl p-4 rounded-3xl border border-white/10">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">CHATUZ</h1>
            <div className="hidden md:flex gap-4 items-center">
              <div className="status-badge"><Globe size={14} /> {userData.country}</div>
              <div className="status-badge"><User size={14} /> {userData.age} yosh</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-semibold text-white/70">
              {partnerConnected ? 'Bog\'langan' : inQueue ? 'Navbatda...' : 'Tayyor'}
            </div>
            {partnerConnected && <div className="online-dot animate-pulse"></div>}
          </div>
        </div>

        {/* The Video Grid */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 mt-24 pb-20">
          {/* Local Video */}
          <div className="video-container group">
            <video ref={localVideoRef} autoPlay muted playsInline className="mirror" />
            <div className="absolute top-4 left-4 glass px-4 py-2 text-xs font-bold uppercase tracking-widest">SIZ</div>
            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <CameraOff size={64} className="text-indigo-500/30" />
              </div>
            )}
          </div>

          {/* Remote Video */}
          <div className="video-container">
            {partnerConnected ? (
              <>
                <video ref={remoteVideoRef} autoPlay playsInline />
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  <div className="glass px-4 py-2 text-xs font-bold uppercase tracking-widest">SUHBATDOSH</div>
                  <div className="glass px-3 py-1.5 text-[10px] flex items-center gap-2">
                    <span>{partnerData?.country}</span>
                    <span>•</span>
                    <span>{partnerData?.age} yosh</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-zinc-900/50 space-y-6">
                {!inQueue ? (
                  <button onClick={startChat} className="primary-btn px-12 py-4 text-xl pulse">Boshlash</button>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-indigo-400 font-bold tracking-widest animate-pulse">QIDIRILMOQDA...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Floating Controls */}
        <div className="controls-overlay">
          <button onClick={toggleMic} className={micOn ? "secondary-btn" : "danger-btn"} title="Mic">
            {micOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          <button onClick={toggleCam} className={camOn ? "secondary-btn" : "danger-btn"} title="Cam">
            {camOn ? <Camera size={24} /> : <CameraOff size={24} />}
          </button>
          <button onClick={nextUser} className="primary-btn px-8" title="Keyingisi">
            <SkipForward size={24} fill="white" />
            <span className="hidden md:inline font-bold">KEYINGISI</span>
          </button>
          <button onClick={reportUser} className="danger-btn" title="Report">
            <AlertTriangle size={24} />
          </button>
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="chat-panel">
        <div className="p-6 border-b border-white/10 flex items-center gap-2 text-indigo-400 font-bold text-lg">
          <MessageSquare size={20} /> CHAT
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center opacity-20 flex-col gap-4">
              <MessageSquare size={48} />
              <p className="text-sm font-medium">Suhbatni boshlang...</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${msg.sender === 'me' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white/10 rounded-bl-none'}`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="p-4 border-t border-white/10 flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Xabar..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <button type="submit" className="p-3 bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all">
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;
