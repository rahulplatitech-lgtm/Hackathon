import React, { useState, useEffect, useRef } from 'react';
import { Mic, PhoneOff, Send, Volume2, VolumeX, Navigation, ArrowUp } from 'lucide-react';
import { sendVoiceAssistantChat, VoiceChatMessage, VoiceChatResponse } from '../../lib/api/reports';

interface ChatGPTVoiceBotProps {
  lat?: number;
  lng?: number;
  onClose: () => void;
  onDispatched?: (response: VoiceChatResponse) => void;
}

type BotState = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'dispatched';

export default function ChatGPTVoiceBot({ lat, lng, onClose, onDispatched }: ChatGPTVoiceBotProps) {
  const [botState, setBotState] = useState<BotState>('connecting');
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [aiText, setAiText] = useState('Connecting to Emergency Assistant...');
  const [isMuted, setIsMuted] = useState(false);
  const [isMicActive, setIsMicActive] = useState(true);
  const [manualText, setManualText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState<{
    type?: string;
    severity?: number;
    urgency?: string;
    resources?: string[];
  }>({});
  const [, setDispatchedData] = useState<VoiceChatResponse | null>(null);

  // Synchronous refs to prevent React state closure bugs
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
      utterance.rate = 1.05;
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

      const estTime = Math.max(2000, (textToSpeak.split(' ').length / 2.5) * 1000 + 1000);
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
        setMessages([{ role: 'assistant', content: res.reply }]);

        speak(res.reply, () => {
          if (!unmounted && isMicActiveRef.current) {
            startListening();
          }
        });
      } catch (err) {
        if (unmounted) return;
        const fallback = 'Emergency Dispatch active. Please describe what happened and where you need help.';
        setAiText(fallback);
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
    setBotState('thinking');

    try {
      const response = await sendVoiceAssistantChat(
        newHistory,
        lat,
        lng
      );

      setAiText(response.reply);
      setMessages([...newHistory, { role: 'assistant', content: response.reply }]);

      setExtractedInfo({
        type: response.incident_type,
        severity: response.severity,
        urgency: response.urgency,
        resources: response.required_resources,
      });

      if (response.ready_to_dispatch || response.dispatched) {
        setBotState('dispatched');
        setDispatchedData(response);
        if (onDispatched) onDispatched(response);
        speak(response.reply, () => {
          setTimeout(() => onClose(), 2500);
        });
      } else {
        speak(response.reply, () => {
          if (isMicActiveRef.current) startListening();
        });
      }
    } catch (err) {
      console.error('Error during voice chat:', err);
      const fallbackReply = 'I received your message and alerted dispatch. What is your exact location or condition?';
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-between p-6 sm:p-10 select-none">
      {/* Top Header */}
      <div className="w-full max-w-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Emergency Voice Assistant</span>
        </div>

        {lat && lng && (
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 font-mono text-xs">
            <Navigation className="w-3.5 h-3.5 text-slate-400" />
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
            onClick={onClose} 
            className="p-2 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition"
            title="End Call"
          >
            <PhoneOff className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Center Voice Orb */}
      <div className="flex flex-col items-center justify-center my-auto w-full max-w-lg text-center space-y-8">
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
          {/* Subtle Outer Ring */}
          <div className="absolute -inset-3 rounded-full bg-blue-500/10 blur-md pointer-events-none" />

          {/* Clean Circular Orb */}
          <div className={`relative w-40 h-40 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center text-white transition-all duration-500 shadow-card ${
            botState === 'speaking'
              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 animate-orb-breathe'
              : botState === 'thinking'
              ? 'bg-gradient-to-br from-indigo-600 to-purple-600'
              : botState === 'listening'
              ? 'bg-gradient-to-br from-slate-800 to-blue-600/80 animate-orb-breathe'
              : 'bg-slate-800'
          }`}>
            <Mic className={`w-10 h-10 ${botState === 'listening' ? 'text-white' : 'text-blue-200'}`} />
            <span className="text-[11px] font-medium tracking-wide uppercase mt-1 opacity-90">
              {botState === 'listening' ? 'Listening' : botState === 'thinking' ? 'Processing' : botState === 'speaking' ? 'Speaking' : 'Ready'}
            </span>
          </div>
        </div>

        {/* Speech Subtitles */}
        <div className="w-full space-y-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm text-left">
            <p className="text-xs text-slate-400 font-medium mb-1">Dispatcher</p>
            <p className="text-base text-slate-100 font-medium leading-relaxed">
              "{aiText}"
            </p>
          </div>

          {currentTranscript ? (
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 flex items-center justify-between gap-3">
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
            <p className="text-xs text-slate-500">Listening to your voice...</p>
          ) : null}

          {/* Extracted Tags */}
          {extractedInfo.type && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs">
                {extractedInfo.type}
              </span>
              {extractedInfo.severity && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 text-xs">
                  Severity {extractedInfo.severity}/5
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-xl flex flex-col items-center gap-3">
        {showTextInput ? (
          <form onSubmit={handleManualSubmit} className="w-full flex items-center gap-2">
            <input 
              type="text"
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder="Or type what happened..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
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
