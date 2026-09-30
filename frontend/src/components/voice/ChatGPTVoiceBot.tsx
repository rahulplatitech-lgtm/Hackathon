import React, { useState, useEffect, useRef } from 'react';
import { Mic, PhoneOff, Send, Volume2, VolumeX, Navigation, ArrowUp, ShieldAlert, CheckCircle2, LifeBuoy } from 'lucide-react';
import { sendVoiceAssistantChat, VoiceChatMessage, VoiceChatResponse } from '../../lib/api/reports';

interface ChatGPTVoiceBotProps {
  lat?: number;
  lng?: number;
  onClose: () => void;
  onDispatched?: (response: VoiceChatResponse) => void;
}

type BotState = 'connecting' | 'listening' | 'thinking' | 'speaking';

const SUGGESTED_QUESTIONS = [
  "What should I do right now?",
  "How long will help take to arrive?",
  "Can I throw water on the fire?",
  "How do I treat the injured person?",
];

export default function ChatGPTVoiceBot({ lat, lng, onClose, onDispatched }: ChatGPTVoiceBotProps) {
  const [botState, setBotState] = useState<BotState>('connecting');
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [aiText, setAiText] = useState('Connecting to Emergency Assistant...');
  const [isMuted, setIsMuted] = useState(false);
  const [isMicActive, setIsMicActive] = useState(true);
  const [manualText, setManualText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [isDispatched, setIsDispatched] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState<{
    type?: string;
    severity?: number;
    urgency?: string;
    resources?: string[];
    location?: string;
  }>({});

  // Synchronous refs to prevent React state closure bugs
  const incidentIdRef = useRef<string | undefined>(undefined);
  const reportIdRef = useRef<string | undefined>(undefined);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesRef = useRef<VoiceChatMessage[]>([]);
  messagesRef.current = messages;
  const transcriptRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);
  const botStateRef = useRef<BotState>('connecting');
  botStateRef.current = botState;
  const isMicActiveRef = useRef<boolean>(true);
  isMicActiveRef.current = isMicActive;

  // Speak text aloud using Web Speech API
  const speak = (textToSpeak: string, onFinish?: () => void) => {
    if (!synthRef.current || isMuted) {
      setBotState('listening');
      if (onFinish) onFinish();
      return;
    }

    try {
      synthRef.current.cancel();
      if (synthRef.current.paused) {
        synthRef.current.resume();
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      currentUtteranceRef.current = utterance;
      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      const voices = synthRef.current.getVoices();
      const preferredVoice = voices.find(v => 
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.lang.startsWith('en')) &&
        !v.name.includes('Whisper')
      );
      if (preferredVoice) utterance.voice = preferredVoice;

      setBotState('speaking');

      let finished = false;
      const done = () => {
        if (!finished) {
          finished = true;
          setBotState('listening');
          if (onFinish) onFinish();
        }
      };

      utterance.onend = done;
      utterance.onerror = done;

      // Safety timeout in case browser speech API hangs
      const estTime = Math.max(2500, (textToSpeak.split(' ').length / 2.2) * 1000 + 1200);
      setTimeout(() => {
        if (!finished && botStateRef.current === 'speaking') {
          done();
        }
      }, estTime);

      synthRef.current.speak(utterance);
    } catch (err) {
      console.error('Speech synthesis error:', err);
      setBotState('listening');
      if (onFinish) onFinish();
    }
  };

  // Start speech recognition
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setShowTextInput(true);
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setBotState('listening');
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
        const clean = fullTranscript.trim();
        transcriptRef.current = clean;
        setCurrentTranscript(clean);

        // Auto-send upon 1.2 seconds of silence
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const spoken = transcriptRef.current.trim();
          if (spoken.length > 0 && botStateRef.current === 'listening') {
            triggerSend(spoken);
          }
        }, 1200);
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          setShowTextInput(true);
        }
      };

      recognition.onend = () => {
        const spoken = transcriptRef.current.trim();
        if (spoken.length > 0 && botStateRef.current === 'listening') {
          triggerSend(spoken);
        } else if (isMicActiveRef.current && botStateRef.current === 'listening') {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setShowTextInput(true);
    }
  };

  const stopListening = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
  };

  const triggerSend = (text: string) => {
    stopListening();
    handleSendMessage(text);
  };

  // Init bot greeting
  useEffect(() => {
    let unmounted = false;

    const init = async () => {
      try {
        const res = await sendVoiceAssistantChat(
          [{ role: 'user', content: 'HELLO_START' }],
          lat,
          lng
        );

        if (unmounted) return;

        setAiText(res.reply);
        const greetingMessages: VoiceChatMessage[] = [{ role: 'assistant', content: res.reply }];
        setMessages(greetingMessages);
        messagesRef.current = greetingMessages;

        speak(res.reply, () => {
          if (!unmounted && isMicActiveRef.current) {
            startListening();
          }
        });
      } catch (err) {
        if (unmounted) return;
        const fallback = 'Crisis Command Emergency AI here. Tell me what happened and what help you need.';
        setAiText(fallback);
        const fallbackMessages: VoiceChatMessage[] = [{ role: 'assistant', content: fallback }];
        setMessages(fallbackMessages);
        messagesRef.current = fallbackMessages;
        speak(fallback, () => {
          if (!unmounted && isMicActiveRef.current) startListening();
        });
      }
    };

    init();

    return () => {
      unmounted = true;
      stopListening();
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  const handleSendMessage = async (userText: string) => {
    if (!userText.trim()) return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setCurrentTranscript('');
    transcriptRef.current = '';
    setManualText('');

    const newHistory: VoiceChatMessage[] = [
      ...messagesRef.current,
      { role: 'user', content: userText }
    ];
    setMessages(newHistory);
    messagesRef.current = newHistory;
    setBotState('thinking');

    try {
      const response = await sendVoiceAssistantChat(
        newHistory,
        lat,
        lng,
        false,
        incidentIdRef.current,
        reportIdRef.current
      );

      setAiText(response.reply);
      const updatedHistory: VoiceChatMessage[] = [
        ...newHistory,
        { role: 'assistant', content: response.reply }
      ];
      setMessages(updatedHistory);
      messagesRef.current = updatedHistory;

      setExtractedInfo({
        type: response.incident_type,
        severity: response.severity,
        urgency: response.urgency,
        resources: response.required_resources,
        location: response.extracted_location,
      });

      if (response.incident_id) {
        incidentIdRef.current = response.incident_id;
      }
      if (response.report_id) {
        reportIdRef.current = response.report_id;
      }

      if (response.dispatched) {
        setIsDispatched(true);
        if (onDispatched) onDispatched(response);
      }

      // DO NOT close the modal! Stay live so caller can continue conversation
      speak(response.reply, () => {
        if (isMicActiveRef.current) startListening();
      });
    } catch (err) {
      console.error('Error during voice chat:', err);
      const fallbackReply = 'I heard you and dispatch is tracking your status. Are you in a safe position right now?';
      setAiText(fallbackReply);
      speak(fallbackReply, () => {
        if (isMicActiveRef.current) startListening();
      });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualText.trim()) {
      handleSendMessage(manualText);
    }
  };

  const toggleMute = () => {
    if (!isMuted) {
      synthRef.current?.cancel();
    }
    setIsMuted(!isMuted);
  };

  const handleEndCall = () => {
    stopListening();
    if (synthRef.current) synthRef.current.cancel();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-8 select-none">
      {/* Top Header */}
      <div className="w-full max-w-2xl flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${isDispatched ? 'bg-emerald-500 animate-ping' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            {isDispatched ? 'Units Dispatched · Live Line' : 'Emergency Voice Assistant'}
          </span>
          {isDispatched && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" /> ETA ~3 mins
            </span>
          )}
        </div>

        {lat && lng && (
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 font-mono text-xs">
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            <span>GPS: {lat.toFixed(3)}, {lng.toFixed(3)}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button 
            onClick={toggleMute} 
            className="p-2 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button 
            onClick={handleEndCall} 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/90 hover:bg-red-600 text-white text-xs font-medium transition shadow-sm cursor-pointer"
            title="End Call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call</span>
          </button>
        </div>
      </div>

      {/* Center Voice Orb */}
      <div className="flex flex-col items-center justify-center my-auto w-full max-w-lg text-center space-y-6">
        <div 
          className="relative cursor-pointer group"
          onClick={() => {
            if (botState === 'listening') {
              const spoken = transcriptRef.current.trim();
              if (spoken.length > 0) triggerSend(spoken);
            } else if (botState === 'speaking') {
              synthRef.current?.cancel();
              setBotState('listening');
              startListening();
            }
          }}
        >
          {/* Subtle Outer Glow */}
          <div className={`absolute -inset-4 rounded-full blur-xl pointer-events-none transition duration-500 ${
            botState === 'speaking' ? 'bg-blue-500/20' : botState === 'listening' ? 'bg-emerald-500/15' : 'bg-slate-500/10'
          }`} />

          {/* Clean Circular Orb */}
          <div className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center text-white transition-all duration-500 shadow-card ${
            botState === 'speaking'
              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 scale-105 shadow-blue-500/25'
              : botState === 'thinking'
              ? 'bg-gradient-to-br from-indigo-600 to-purple-600 animate-pulse'
              : botState === 'listening'
              ? 'bg-gradient-to-br from-slate-900 to-blue-600/90 border border-blue-500/30'
              : 'bg-slate-900 border border-slate-800'
          }`}>
            <Mic className={`w-9 h-9 sm:w-10 sm:h-10 transition duration-300 ${
              botState === 'listening' ? 'text-emerald-400 scale-110' : 'text-white'
            }`} />
            <span className="text-[10px] sm:text-[11px] font-medium tracking-wider uppercase mt-2 opacity-90">
              {botState === 'listening' ? 'Listening...' : botState === 'thinking' ? 'Processing...' : botState === 'speaking' ? 'Speaking...' : 'Ready'}
            </span>
          </div>
        </div>

        {/* Speech Transcript & AI Subtitles */}
        <div className="w-full space-y-3">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-blue-400 font-semibold tracking-wide flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Dispatcher AI
              </span>
              {isDispatched && (
                <span className="text-[10px] text-emerald-400 font-medium">Rescue Units Moving</span>
              )}
            </div>
            <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
              "{aiText}"
            </p>
          </div>

          {currentTranscript ? (
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-200 flex items-center justify-between gap-3">
              <span className="truncate">"{currentTranscript}"</span>
              <button
                onClick={() => triggerSend(currentTranscript)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition shrink-0"
              >
                <span>Send</span>
                <ArrowUp className="w-3 h-3" />
              </button>
            </div>
          ) : botState === 'listening' ? (
            <p className="text-xs text-slate-400">Listening to your voice... Speak naturally or ask questions.</p>
          ) : null}

          {/* Quick Informational Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {extractedInfo.type && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs">
                {extractedInfo.type}
              </span>
            )}
            {extractedInfo.severity && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-xs">
                Severity {extractedInfo.severity}/5
              </span>
            )}
            {isDispatched && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Dispatched
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Area: Suggested Quick Prompts & Input */}
      <div className="w-full max-w-xl flex flex-col items-center gap-3">
        {/* Suggested Tap-to-Ask Prompts */}
        <div className="w-full flex items-center justify-center gap-2 overflow-x-auto pb-1 text-xs">
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] hover:text-white whitespace-nowrap transition cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {showTextInput ? (
          <form onSubmit={handleManualSubmit} className="w-full flex items-center gap-2">
            <input 
              type="text"
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder="Type your question or report here..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={!manualText.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <button 
            onClick={() => setShowTextInput(true)}
            className="text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Prefer typing? Click here to text
          </button>
        )}
      </div>
    </div>
  );
}
