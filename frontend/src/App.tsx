import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Camera, CameraOff, Mic, MicOff, SkipForward, Play, Square, Globe, User, Send, AlertCircle } from 'lucide-react';
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

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
  };

  // Pre-initialize socket even before AgeConfirmation to get online count
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('online-count', (count: number) => {
      setOnlineCount(count);
    });

    socketRef.current.on('match-found', async ({ partnerId, initiator, partnerInfo }) => {
      console.log('Match found! Initiator:', initiator);
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
        try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { }
      }
    });

    socketRef.current.on('partner-disconnected', () => {
      resetPeerConnection();
      setPartnerConnected(false);
      setPartnerData(null);
      // Wait a bit and rejoin queue if we were in it
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
    return () => {
      localStream?.getTracks().forEach(track => track.stop());
    };
  }, [userData]);

  const initMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      console.error('Media error:', err);
    }
  };

  const createPeerConnection = (partnerId: string) => {
    resetPeerConnection();
    peerConnectionRef.current = new RTCPeerConnection(configuration);

    // Safety: check localStream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnectionRef.current?.addTrack(track, localStream);
      });
    }

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
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
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
    <div className="flex flex-col h-screen w-full bg-[#0b1120]">
      {/* Video Section */}
      <div className="video-grid">
        <div className="video-box">
          <div className="badge">SIZ</div>
          <video ref={localVideoRef} autoPlay muted playsInline className="mirror" />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
              <CameraOff size={64} className="text-white/20" />
            </div>
          )}
          {/* Overlay Mic/Cam Toggles */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button onClick={toggleMic} className={`p-3 rounded-full ${micOn ? 'bg-white/10' : 'bg-red-500/80'} backdrop-blur-md border border-white/10`}>
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button onClick={toggleCam} className={`p-3 rounded-full ${camOn ? 'bg-white/10' : 'bg-red-500/80'} backdrop-blur-md border border-white/10`}>
              {camOn ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>
          </div>
        </div>

        <div className="video-box">
          <div className="badge">{partnerConnected ? "SUHBATDOSH" : "IDIRILMOQDA..."}</div>
          {partnerConnected ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline />
              <div className="absolute bottom-4 left-4 glass px-4 py-2 text-xs flex gap-4">
                <span className="flex items-center gap-1"><Globe size={14} /> {partnerData?.country}</span>
                <span className="flex items-center gap-1"><User size={14} /> {partnerData?.age} yosh</span>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-gray-900/40">
              {inQueue ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-blue-400 font-bold tracking-widest text-sm">SUHBATDOSH QIDIRILMOQDA...</span>
                </div>
              ) : (
                <div className="text-center opacity-30">
                  <Play size={80} />
                  <p className="mt-4 font-bold uppercase tracking-widest text-xs">Boshlash tugmasini bosing</p>
                </div>
              )}
            </div>
          )}
          {partnerConnected && (
            <button
              onClick={() => { socketRef.current?.emit('report-user'); nextUser(); }}
              className="absolute top-4 right-4 p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg border border-red-500/30 text-red-500 transition-all"
              title="Report"
            >
              <AlertCircle size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="bottom-panel relative">
        <div className="main-controls">
          <div
            onClick={toggleChat}
            className={`control-block ${inQueue || partnerConnected ? 'active' : ''}`}
          >
            {inQueue || partnerConnected ? <Square size={32} /> : <Play size={32} fill="currentColor" />}
            <span>{inQueue || partnerConnected ? "Stop" : "Start"}</span>
          </div>

          <div
            onClick={nextUser}
            className={`control-block ${!inQueue && !partnerConnected ? 'disabled' : ''}`}
          >
            <SkipForward size={32} fill="currentColor" />
            <span>Keyingisi</span>
          </div>

          <div className="control-block active">
            <Globe size={32} />
            <span>{userData.country.split(' (')[0]}</span>
          </div>

          <div className="control-block active hidden sm:flex">
            <User size={32} />
            <span>{onlineCount} Real</span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col max-w-[500px] h-[100px] bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide text-xs">
            {messages.length === 0 && <p className="text-center text-white/20 mt-4">Suhbat hali boshlanmadi...</p>}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-3 py-1.5 rounded-xl ${m.sender === 'me' ? 'bg-blue-600' : 'bg-white/10'}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="h-10 border-t border-white/10 flex items-center px-2 gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Xabar yozing (Enter)"
              className="flex-1 bg-transparent border-none outline-none text-sm text-white"
            />
            <button type="submit" className="text-blue-500 hover:text-blue-400">
              <Send size={18} />
            </button>
          </form>
        </div>

        <div className="absolute right-4 bottom-2 text-[10px] text-white/20 font-bold tracking-widest hidden lg:block">
          YARATUVCHI: SHONAZAROV DIYORBEK
        </div>
      </div>
    </div>
  );
};

export default App;
