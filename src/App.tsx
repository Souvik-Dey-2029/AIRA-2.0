/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Power, RefreshCw, Zap, Music, Send, Bell, StickyNote, Camera, X, ExternalLink, MessageSquare } from "lucide-react";
import { LiveSession, SessionState } from "./services/live-session";

interface Note {
  id: string;
  content: string;
  type: 'SONG' | 'NOTE' | 'REMINDER' | 'STATUS' | 'FUNNY';
  timestamp: string;
}

export default function App() {
  const [state, setState] = useState<SessionState>("DISCONNECTED");
  const [userVolume, setUserVolume] = useState(0);
  const [airaVolume, setAiraVolume] = useState(0);
  const [lastTranscript, setLastTranscript] = useState<{ role: string; text: string } | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const [isMusicPaused, setIsMusicPaused] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  
  const sessionRef = useRef<LiveSession | null>(null);
  const notesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (notesEndRef.current) {
      notesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [notes]);

  const addNote = (content: string, type: Note['type']) => {
    const newNote: Note = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setNotes(prev => [...prev.slice(-15), newNote]);
  };

  const handleToolCall = (name: string, args: any) => {
    console.log("App received tool call:", name, args);
    setLastAction(name);
    setTimeout(() => setLastAction(null), 3000);

    switch (name) {
      case "playMusic":
        setNowPlaying(args.query);
        setIsMusicPaused(false);
        addNote(`Playing: ${args.query}`, 'SONG');
        // Actual playback via hidden YouTube embed search
        const playerFrame = document.getElementById('music-player-frame') as HTMLIFrameElement;
        if (playerFrame) {
          playerFrame.src = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(args.query)}&autoplay=1&enablejsapi=1`;
        }
        break;
      case "addNote":
        addNote(args.content, args.type);
        break;
      case "capturePhoto":
        setIsCameraActive(true);
        setTimeout(() => setIsCameraActive(false), 500);
        addNote("Photo captured! You look great 😭", 'STATUS');
        break;
      case "sendMessage":
        addNote(`Message sent to ${args.recipient}`, 'STATUS');
        break;
      case "setReminder":
        addNote(`Reminder: ${args.text}`, 'REMINDER');
        break;
      default:
        break;
    }
  };

  const initSession = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setErrorMessage("Gemini API Key missing. Please check your environment.");
      return null;
    }
    
    return new LiveSession(
      apiKey, 
      (newState) => {
        setState(newState);
        if (newState === "IDLE" || newState === "DISCONNECTED") {
          setUserVolume(0);
          setAiraVolume(0);
        }
      },
      (vol) => setUserVolume(vol),
      (vol) => setAiraVolume(vol),
      (role, text) => setLastTranscript({ role, text }),
      (name, args) => handleToolCall(name, args),
      (errMsg) => setErrorMessage(errMsg),
      (active, notice) => {
        setIsMicActive(active);
        if (notice) setMicNotice(notice);
        else setMicNotice(null);
      }
    );
  };

  const toggleSession = async () => {
    if (state === "DISCONNECTED") {
      setErrorMessage(null);
      try {
        const session = initSession();
        if (!session) return;
        sessionRef.current = session;
        await session.connect();
      } catch (err: any) {
        console.warn("Session connection failed:", err);
        setState("DISCONNECTED");
        const msg = err?.message || "Failed to establish live session. Please check your connection.";
        setErrorMessage(msg);
      }
    } else {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
      setState("DISCONNECTED");
      setIsMicActive(false);
      setMicNotice(null);
      setUserVolume(0);
      setAiraVolume(0);
      setLastTranscript(null);
      setNotes([]);
      setNowPlaying(null);
    }
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim()) return;
    const msg = textInput.trim();
    setTextInput("");

    if (state === "DISCONNECTED") {
      try {
        const session = initSession();
        if (!session) return;
        sessionRef.current = session;
        await session.connect();
        await session.sendTextMessage(msg);
      } catch (err: any) {
        console.warn("Failed to start session via text message:", err);
        setErrorMessage(err?.message || "Failed to connect to AIRA.");
      }
    } else {
      await sessionRef.current?.sendTextMessage(msg);
    }
  };

  const handleToggleMic = async () => {
    if (state === "DISCONNECTED") {
      await toggleSession();
      return;
    }
    if (sessionRef.current) {
      await sessionRef.current.toggleMic();
    }
  };

  const toggleMusicPlayback = () => {
    const playerFrame = document.getElementById('music-player-frame') as HTMLIFrameElement;
    if (playerFrame && playerFrame.contentWindow) {
      const action = isMusicPaused ? '{"event":"command","func":"playVideo","args":""}' : '{"event":"command","func":"pauseVideo","args":""}';
      playerFrame.contentWindow.postMessage(action, '*');
      setIsMusicPaused(!isMusicPaused);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#020205] text-white flex flex-col md:flex-row p-6 md:p-12 overflow-hidden selection:bg-pink-500/30 selection:text-white font-sans">
      {/* Cinematic Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-[0.05]"
          style={{ 
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
            transform: 'perspective(1000px) rotateX(60deg) translateY(-100px)',
            transformOrigin: 'top'
          }}
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3], x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] max-w-[800px] bg-pink-900/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.4, 0.3], x: [0, -40, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] max-w-[700px] bg-indigo-900/20 rounded-full blur-[100px]" 
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
      </div>

      {/* Camera Flash Effect */}
      <AnimatePresence>
        {isCameraActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[100] flex items-center justify-center"
          >
             <Camera className="w-24 h-24 text-black animate-ping" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-between z-10 relative">
        {/* Top Navigation */}
        <header className="w-full flex justify-between items-start">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col">
            <div className="flex items-center space-x-2 mb-1">
              <span className="w-1 h-3 bg-pink-600 rounded-full" />
              <span className="text-[10px] uppercase tracking-[0.4em] text-white/50 font-bold font-mono">Neural Interface</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-white via-pink-100 to-pink-500">
              AIRA <span className="text-pink-600">.</span>
            </h1>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex space-x-8 md:space-x-12">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1 font-mono">Real-time Node</p>
              <p className="text-[10px] font-mono tracking-tighter uppercase text-white/70">GEMINI_3.1_LIVE</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1 font-mono">Status</p>
              <div className="flex items-center space-x-2 shadow-2xl justify-end">
                 <span className={`w-1.5 h-1.5 rounded-full ${state !== "DISCONNECTED" ? "bg-pink-500 animate-pulse" : "bg-white/20"}`} />
                 <span className="text-[10px] font-mono tracking-tighter uppercase">{state}</span>
              </div>
            </div>
          </motion.div>
        </header>

        {/* Central Visual Hub */}
        <main className="relative flex-1 flex flex-col items-center justify-center w-full">
          {/* Animated Background Rings */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {[1, 2, 3].map((ring) => (
              <motion.div
                key={ring}
                className="absolute rounded-full border border-pink-500/10"
                initial={{ width: 300, height: 300, opacity: 0 }}
                animate={{ 
                  width: [250, ring * 250, ring * 350], 
                  height: [250, ring * 250, ring * 350],
                  opacity: state !== "DISCONNECTED" ? [0, 0.4, 0] : 0,
                }}
                transition={{ duration: 4 / ring, repeat: Infinity, ease: "easeOut", delay: ring * 0.5 }}
                style={{
                  borderWidth: state === "SPEAKING" ? 2 : 1,
                  borderColor: state === "SPEAKING" ? `rgba(236, 72, 153, ${0.15 * ring})` : `rgba(255, 255, 255, ${0.05 * ring})`
                }}
              />
            ))}
          </div>

          {/* User Input Wave (Pulse) */}
          {state === "LISTENING" && (
            <motion.div 
              className="absolute w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full border-[10px] border-white/5 blur-2xl z-0"
              animate={{ scale: [1, 1 + userVolume * 2, 1] }}
              transition={{ duration: 0.1 }}
            />
          )}

          {/* AI Output Wave (Pulse) */}
          {state === "SPEAKING" && (
            <motion.div 
              className="absolute w-[400px] h-[400px] md:w-[500px] md:h-[500px] rounded-full border-[20px] border-pink-500/5 blur-3xl z-0"
              animate={{ scale: [1, 1 + airaVolume * 2.5, 1] }}
              transition={{ duration: 0.1 }}
            />
          )}

          {/* The Orb */}
          <div className="relative group cursor-pointer z-10" onClick={toggleSession}>
            <motion.div 
              className="absolute inset-0 rounded-full bg-pink-600/30 blur-[60px]"
              animate={{ 
                scale: state === "SPEAKING" ? [1, 1.4, 1] : state === "LISTENING" ? [1, 1.2, 1] : [1, 1.1, 1],
                opacity: state !== "DISCONNECTED" ? [0.4, 0.7, 0.4] : 0.1
              }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <motion.div 
              className={`relative w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden flex items-center justify-center border transition-all duration-1000 shadow-2xl ${
                state !== "DISCONNECTED" 
                  ? "bg-white/10 border-pink-500/30 backdrop-blur-3xl" 
                  : "bg-white/5 grayscale border-white/10 backdrop-blur-sm shadow-none"
              }`}
              animate={{
                scale: state === "SPEAKING" ? 1 + airaVolume * 0.25 : state === "LISTENING" ? 1 + userVolume * 0.2 : 1,
              }}
            >
              <AnimatePresence mode="wait">
                {state === "DISCONNECTED" ? (
                  <motion.div key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Power className="w-16 h-16 text-white/20" />
                  </motion.div>
                ) : state === "CONNECTING" ? (
                  <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <RefreshCw className="w-12 h-12 animate-spin text-pink-400" />
                  </motion.div>
                ) : (
                  <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-[4px] h-20">
                    {[...Array(state === "SPEAKING" ? 12 : 5)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 md:w-2 bg-gradient-to-t from-pink-600 to-white rounded-full"
                        animate={{ 
                          height: state === "SPEAKING" ? [10, 10 + airaVolume * 120, 10] : state === "LISTENING" ? [5, 5 + userVolume * 80, 5] : [5, 15, 5],
                          opacity: [0.3, 1, 0.3]
                        }}
                        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            
            {/* Status Tooltip Overlay */}
            <motion.div 
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full border border-white/10 bg-black/40 backdrop-blur-md"
              initial={false}
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${state === "LISTENING" ? "bg-white animate-pulse" : "bg-pink-500"}`} />
                <span className="text-[10px] font-mono tracking-widest text-white/70 uppercase">{state}</span>
              </div>
            </motion.div>
          </div>

          {/* Transcript / Tool Info */}
          <div className="mt-16 text-center max-w-sm px-6">
            <AnimatePresence mode="wait">
              {lastAction && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-2 text-pink-500 text-[10px] font-mono uppercase tracking-[0.2em] mb-4">
                  <Zap className="w-3 h-3 animate-pulse" />
                  <span>ACTION EXECUTED: {lastAction}</span>
                </motion.div>
              )}
              {lastTranscript ? (
                <motion.div key={lastTranscript.text} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                  <span className={`text-[9px] uppercase tracking-widest font-mono italic ${lastTranscript.role === 'user' ? 'text-white/30' : 'text-pink-500/50'}`}>
                    {lastTranscript.role === "user" ? "Bio-input" : "AIRA-process"}
                  </span>
                  <p className="text-lg md:text-xl text-white/90 leading-tight font-medium line-clamp-3 italic">
                    "{lastTranscript.text}"
                  </p>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                   <p className="text-xl font-serif italic text-white/40">
                    {state === "DISCONNECTED" ? "Synchronize with AIRA to begin." : "I'm listening..."}
                  </p>
                  <div className="flex gap-1">
                     {[1, 2, 3].map(i => (
                       <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }} className="w-1 h-1 bg-white/20 rounded-full" />
                     ))}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Real-time Interaction Bar (Voice toggle & Text input fallback) */}
          <div className="w-full max-w-lg px-4 mt-6 z-20 flex flex-col items-center gap-2.5">
            {/* Microphone Notice / Fallback Chip */}
            <AnimatePresence>
              {state !== "DISCONNECTED" && !isMicActive && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-pink-500/20 text-[11px] text-white/80 backdrop-blur-md shadow-lg"
                >
                  <MicOff className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span className="truncate max-w-[210px] sm:max-w-xs text-white/70">
                    Mic muted/unavailable • Type below to chat
                  </span>
                  <button
                    onClick={handleToggleMic}
                    className="px-2.5 py-0.5 rounded-full bg-pink-600/30 hover:bg-pink-600/50 text-pink-300 font-semibold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Enable Mic
                  </button>
                  <button
                    onClick={() => window.open(window.location.href, "_blank")}
                    title="Open in new window for direct mic access"
                    className="p-1 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Message Input Box */}
            <form 
              onSubmit={handleSendMessage}
              className="w-full flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl focus-within:border-pink-500/50 shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all"
            >
              <button
                type="button"
                onClick={handleToggleMic}
                title={isMicActive ? "Mute Microphone" : "Enable Microphone"}
                className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                  isMicActive 
                    ? "bg-pink-600 text-white shadow-[0_0_12px_rgba(236,72,153,0.5)]" 
                    : "bg-white/5 text-white/40 hover:text-white/80"
                }`}
              >
                {isMicActive ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
              </button>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={state === "DISCONNECTED" ? "Type to connect and talk with AIRA..." : "Say or type something to AIRA..."}
                className="flex-1 bg-transparent border-none outline-none text-xs md:text-sm text-white placeholder-white/30 font-medium px-1"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="p-2 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-30 disabled:hover:bg-pink-600 text-white transition-all cursor-pointer shrink-0 shadow-md shadow-pink-600/20 active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </main>

        {/* Bottom Control & Telemetry */}
        <footer className="w-full flex flex-col md:flex-row justify-between items-center md:items-end gap-12 pb-4">
          {/* Telemetry Panel */}
          <div className="w-64 hidden lg:block group">
            <div className="flex items-center space-x-2 mb-2 text-white/20">
              <Zap className="w-3 h-3 text-pink-500" />
              <p className="text-[9px] uppercase tracking-widest font-mono">Neural Load Performance</p>
            </div>
            <div className="flex gap-[2px] h-2">
              {[...Array(15)].map((_, i) => (
                <motion.div 
                  key={i}
                  className={`flex-1 h-full rounded-[1px] ${i < (state === "SPEAKING" ? 12 : state === "LISTENING" ? 8 : 3) ? "bg-pink-600 shadow-[0_0_8px_rgba(236,72,153,0.5)]" : "bg-white/5"}`}
                  animate={i < 5 ? { opacity: [0.4, 1, 0.4] } : {}}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[8px] text-white/10 uppercase tracking-tighter">
              <span>Latency: 42ms</span>
              <span>Buffer: 1024kb</span>
              <span>Sync: OK</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <motion.button 
              onClick={toggleSession}
              className={`p-5 rounded-full border transition-all duration-500 relative group ${
                state !== "DISCONNECTED" ? "bg-pink-600 border-pink-400 shadow-2xl" : "bg-white/5 border-white/10"
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {state !== "DISCONNECTED" && (
                <motion.div 
                  className="absolute inset-0 rounded-full border-2 border-pink-500"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}
              {state !== "DISCONNECTED" ? <Power className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </motion.button>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3 text-white/30 uppercase tracking-[0.4em] font-mono text-[9px]">
                <div className="h-[1px] w-6 bg-current opacity-20" />
                <span>{state === "DISCONNECTED" ? "STANDBY_MODE" : "ACTIVE_STREAM"}</span>
                <div className="h-[1px] w-6 bg-current opacity-20" />
              </div>
              <p className="text-[8px] text-pink-500/40 font-mono tracking-[0.5em] font-black group-hover:text-pink-500 transition-colors uppercase">
                Souvik Neural Engine v1.0
              </p>
            </div>
          </div>

          <div className="w-64 hidden lg:flex flex-col items-end">
            <div className="flex gap-2">
              {["NET", "VOX", "AI"].map((node) => (
                <div 
                  key={node}
                  className={`w-10 h-10 rounded-xl bg-white/5 border flex flex-col items-center justify-center text-[8px] font-mono font-bold transition-all ${
                    state !== "DISCONNECTED" ? "border-pink-500/30 text-pink-400" : "border-white/10 text-white/10"
                  }`}
                >
                  <p className="opacity-40">{node}</p>
                  <div className={`w-1 h-1 rounded-full mt-1 ${state !== "DISCONNECTED" ? "bg-pink-500 shadow-[0_0_5px_#ec4899]" : "bg-white/10"}`} />
                </div>
              ))}
            </div>
          </div>
        </footer>
      </div>

      {/* RIGHT SIDE: Notes Board (The "Memory" and "Action" log) */}
      <aside className="w-full md:w-80 h-[300px] md:h-full z-20 flex flex-col mt-8 md:mt-0 md:ml-8">
        <div className="flex-1 glass-panel rounded-3xl overflow-hidden flex flex-col p-6 shadow-2xl relative">
          {/* Panel Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
             <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-pink-500" />
                <span className="text-[10px] uppercase font-mono tracking-widest text-white/60 font-bold">AIRA's Workspace</span>
             </div>
             {state !== "DISCONNECTED" && (
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }} className="w-2 h-2 bg-pink-500 rounded-full shadow-[0_0_8px_#ec4899]" />
             )}
          </div>

          {/* List of Notes */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-none custom-scrollbar">
            {notes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-white/20">
                   <MessageSquare className="w-6 h-6" />
                </div>
                <p className="text-[11px] font-mono text-white/40 leading-relaxed uppercase tracking-widest">
                  No active memories yet. <br/> Start talking to AIRA.
                </p>
              </div>
            ) : (
              notes.map((note) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-2 group hover:bg-white/10 transition-all cursor-default"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                      note.type === 'SONG' ? 'bg-pink-900/50 text-pink-400' :
                      note.type === 'REMINDER' ? 'bg-blue-900/50 text-blue-400' :
                      note.type === 'STATUS' ? 'bg-green-900/50 text-green-400' :
                      'bg-white/10 text-white/50'
                    }`}>
                      {note.type}
                    </span>
                    <span className="text-[8px] font-mono text-white/20">{note.timestamp}</span>
                  </div>
                  <p className="text-[13px] text-white/80 leading-snug">
                    {note.content}
                  </p>
                  {note.type === 'SONG' && (
                    <motion.div animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="flex items-center gap-1.5 pt-1">
                       <Music className="w-3 h-3 text-pink-500" />
                       <span className="text-[9px] font-mono text-pink-500/80 animate-pulse">Live stream active</span>
                    </motion.div>
                  )}
                </motion.div>
              ))
            )}
            <div ref={notesEndRef} />
          </div>

          {/* Now Playing Widget */}
          <AnimatePresence>
            {nowPlaying && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="mt-4 p-5 rounded-[2rem] bg-gradient-to-br from-pink-600/20 to-indigo-600/10 border border-white/10 flex flex-col gap-5 group backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-pink-600 flex items-center justify-center relative overflow-hidden shadow-[0_0_30px_#ec489955]">
                    <Music className="text-white w-6 h-6 z-10" />
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="absolute inset-0 bg-gradient-to-br from-pink-400 to-transparent opacity-60" />
                    {/* Pulsing glow inside art */}
                    {!isMusicPaused && (
                      <motion.div 
                        animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }} 
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 bg-white rounded-full blur-xl" 
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-pink-500 font-black mb-1">Live from AIRA</p>
                    <p className="text-sm text-white font-bold truncate italic leading-tight">"{nowPlaying}"</p>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">{isMusicPaused ? 'Paused' : 'Streaming'}</span>
                       {!isMusicPaused && (
                         <div className="flex gap-0.5 h-2 items-end">
                            {[...Array(4)].map((_, i) => (
                              <motion.div key={i} animate={{ height: [2, 8, 2] }} transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }} className="w-0.5 bg-pink-500" />
                            ))}
                         </div>
                       )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => {
                        setNowPlaying(null);
                        const playerFrame = document.getElementById('music-player-frame') as HTMLIFrameElement;
                        if (playerFrame) playerFrame.src = "";
                      }} className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/30 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Player Controls Panel */}
                <div className="flex flex-col gap-4 pt-2 border-t border-white/5">
                   <div className="relative w-full h-[3px] bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ x: '-100%' }}
                        animate={!isMusicPaused ? { x: '100%' } : {}}
                        transition={!isMusicPaused ? { duration: 60, repeat: Infinity, ease: "linear" } : {}}
                        className="absolute inset-0 bg-gradient-to-r from-pink-500 to-indigo-500"
                      />
                   </div>
                   
                   <div className="flex items-center justify-center gap-8">
                      <button className="text-white/20 hover:text-white transition-colors">
                         <RefreshCw className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={toggleMusicPlayback}
                        className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-xl"
                      >
                         {isMusicPaused ? (
                           <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-black border-b-[8px] border-b-transparent ml-1" />
                         ) : (
                           <div className="flex gap-1.5 font-bold">
                              <div className="w-1.5 h-4 bg-black rounded-full" />
                              <div className="w-1.5 h-4 bg-black rounded-full" />
                           </div>
                         )}
                      </button>
                      <button className="text-white/20 hover:text-white transition-colors">
                         <Send className="w-4 h-4 rotate-45" />
                      </button>
                   </div>
                </div>

                {/* The actual hidden player */}
                <iframe 
                  id="music-player-frame"
                  className="hidden"
                  allow="autoplay"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* UI status overlay */}
          <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
             <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        </div>
      </aside>

      {/* Error / Alert Recovery Modal */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-md bg-[#0b0b14] border border-pink-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(236,72,153,0.15)] text-white relative"
            >
              <button
                onClick={() => setErrorMessage(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-4 mb-4">
                <div className="p-3.5 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 shrink-0">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Connection Notice</h3>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setErrorMessage(null);
                    toggleSession();
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-xs tracking-wider uppercase transition-all shadow-lg shadow-pink-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Connection</span>
                </button>
                <button
                  onClick={() => {
                    window.open(window.location.href, "_blank");
                  }}
                  title="Open in new tab"
                  className="py-3 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

