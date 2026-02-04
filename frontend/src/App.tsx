import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Camera, CameraOff, Mic, MicOff, SkipForward, AlertTriangle, MessageSquare, Send, Globe, User } from 'lucide-react';
import AgeConfirmation from './components/AgeConfirmation';

const SOCKET_URL = 'http://localhost:5000';

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
      console.log('Match found with:', partnerId);
      setInQueue(false);
      setPartnerConnected(true);
      setPartnerData(partnerInfo || { age: 'Noma\'lum', country: 'Noma\'lum' });
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
          console.error('Error adding ice candidate', e);
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
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing media devices:', err);
      alert('Kamera va mikrofonga ruxsat berilishi shart!');
    }
  };

  const createPeerConnection = (partnerId: string) => {
    resetPeerConnection();
    peerConnectionRef.current = new RTCPeerConnection(configuration);

    localStream?.getTracks().forEach(track => {
      peerConnectionRef.current?.addTrack(track, localStream);
    });

    peerConnectionRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
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
    <div className="flex flex-col h-screen w-full text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 glass m-4 mb-0">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold tracking-tighter" style={{ background: 'linear-gradient(to right, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CHATUZ
          </h1>
          <div className="hidden md:flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1"><Globe size={12} /> {userData.country}</div>
            <div className="flex items-center gap-1"><User size={12} /> {userData.age} yosh</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 font-medium">
            {partnerConnected ? 'Bog\'langan' : inQueue ? 'Qidirilmoqda...' : 'Tayyor'}
          </span>
          <div className={`w-3 h-3 rounded-full ${partnerConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : inQueue ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'}`}></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-hidden">
        {/* Videos Container */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            {/* Local Video */}
            <div className="relative glass overflow-hidden rounded-2xl bg-black/40">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              <div className="absolute top-4 left-4 glass px-3 py-1 text-xs flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Siz
              </div>
              {!camOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
                  <CameraOff size={48} className="text-indigo-500/50" />
                </div>
              )}
            </div>

            {/* Remote Video */}
            <div className="relative glass overflow-hidden rounded-2xl bg-black/40">
              {partnerConnected ? (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 glass px-3 py-1 text-xs flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div> Suhbatdosh
                    </div>
                    {partnerData && (
                      <div className="text-[10px] text-gray-400 flex gap-2">
                        <span>{partnerData.country}</span>
                        <span>{partnerData.age} yosh</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <div className="w-20 h-20 border-2 border-indigo-500/20 rounded-full"></div>
                    <div className="absolute inset-0 w-20 h-20 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                  </div>
                  <div className="text-center group">
                    <p className="text-indigo-400 font-medium tracking-wide">{inQueue ? 'Suhbatdosh qidirilmoqda...' : 'Muloqotni boshlashga tayyormisiz?'}</p>
                    {!inQueue && <p className="text-gray-500 text-xs mt-2">Pastdagi "Boshlash" tugmasini bosing</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="glass p-6 flex flex-wrap items-center justify-center gap-6">
            {!inQueue && !partnerConnected ? (
              <button onClick={startChat} className="primary-btn px-16 py-5 text-xl">Boshlash</button>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button onClick={toggleMic} className={`p-4 rounded-2xl transition-all duration-300 ${micOn ? 'secondary-btn' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`} title="Mikrofonni o‘chirish">
                    {micOn ? <Mic size={24} /> : <MicOff size={24} />}
                  </button>
                  <button onClick={toggleCam} className={`p-4 rounded-2xl transition-all duration-300 ${camOn ? 'secondary-btn' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`} title="Kamerani o‘chirish">
                    {camOn ? <Camera size={24} /> : <CameraOff size={24} />}
                  </button>
                </div>
                <button onClick={nextUser} className="primary-btn flex items-center gap-3 px-10">
                  <SkipForward size={22} fill="currentColor" /> Keyingisi
                </button>
                <button onClick={reportUser} className="danger-btn flex items-center gap-2 p-4" title="Shikoyat qilish">
                  <AlertTriangle size={24} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="w-full md:w-96 flex flex-col glass overflow-hidden">
          <div className="p-4 border-b border-white/5 font-bold flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400">
              <MessageSquare size={18} /> Chat
            </div>
            {partnerConnected && partnerData && (
              <span className="text-[10px] bg-white/5 px-2 py-1 rounded-full text-gray-400">
                {partnerData.country}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm opacity-50 space-y-2">
                <MessageSquare size={32} />
                <p>Xabarlar hali mavjud emas</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm ${msg.sender === 'me' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white/5 text-gray-200 rounded-tl-none border border-white/5'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="p-4 border-t border-white/5 flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Xabar yozing..."
              className="flex-1 text-sm"
            />
            <button type="submit" className="p-3 bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default App;
