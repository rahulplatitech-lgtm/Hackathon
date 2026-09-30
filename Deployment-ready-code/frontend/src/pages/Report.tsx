import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mic, MicOff, Send, Volume2, VolumeX, Shield, ShieldAlert, CheckCircle2, 
  AlertTriangle, Flame, Activity, Car, ArrowRight, Loader2, Navigation, 
  Clock, Users, RefreshCw, LifeBuoy, ArrowUp, AlertCircle, PhoneCall
} from 'lucide-react';
import { useLocation } from '../hooks/useLocation';
import { sendVoiceAssistantChat, VoiceChatMessage, VoiceChatResponse } from '../lib/api/reports';
import SeverityBadge from '../components/ui/SeverityBadge';

type BotState = 'connecting' | 'listening' | 'thinking' | 'speaking';

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isDispatchNotice?: boolean;
}

const EMERGENCY_PRESETS = [
  { label: 'Structure Fire', icon: Flame, text: 'A fire broke out on the second floor of a residential building. Smoke is spreading fast.' },
  { label: 'Vehicle Crash', icon: Car, text: 'Two-car collision at the intersection. Two victims are bleeding and traffic is blocked.' },
  { label: 'Medical Alert', icon: Activity, text: 'An elderly person collapsed and is unconscious with breathing difficulty.' },
  { label: 'Gas Leak', icon: AlertTriangle, text: 'Strong smell of gas leaking inside the apartment complex. Hissing sound heard.' },
];

const QUICK_RESPONSES = [
  "Everyone evacuated outside safely",
  "Two people injured and bleeding",
  "Nobody is trapped inside",
  "Yes, please dispatch emergency units now",
  "What should I do right now while waiting?",
  "How long will help take to arrive?"
];

export default function Report() {
  const navigate = useNavigate();
  const { lat, lng, requestLocation } = useLocation();

  // Chat and Voice State
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [botState, setBotState] = useState<BotState>('connecting');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [hasRequestedMic, setHasRequestedMic] = useState(false);

  // Extracted Telemetry
  const [incidentType, setIncidentType] = useState<string>('Assessing Emergency...');
  const [severity, setSeverity] = useState<number>(3);
  const [urgency, setUrgency] = useState<string>('HIGH');
  const [peopleAffected, setPeopleAffected] = useState<number>(1);
  const [requiredResources, setRequiredResources] = useState<string[]>(['AMBULANCE']);
  const [extractedLocation, setExtractedLocation] = useState<string>('');

  // Satisfaction & Transition State
  const [isSatisfied, setIsSatisfied] = useState(false);
  const [dispatchedIncidentId, setDispatchedIncidentId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Synchronous Refs to avoid stale closures
  const incidentIdRef = useRef<string | undefined>(undefined);
  const reportIdRef = useRef<string | undefined>(undefined);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const transcriptRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);
  const botStateRef = useRef<BotState>('connecting');
  botStateRef.current = botState;
  const isMicActiveRef = useRef<boolean>(false);
  isMicActiveRef.current = isMicActive;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesDataRef = useRef<VoiceChatMessage[]>([]);

  // Auto-scroll chat stream to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, botState, currentTranscript]);

  // Request browser GPS on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Web Speech Text-to-Speech
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

      // Safety timeout in case browser speech API halts
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

  // Web Speech Speech-to-Text Recognition
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser.');
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
        setIsMicActive(true);
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
        const clean = fullTranscript.trim();
        transcriptRef.current = clean;
        setCurrentTranscript(clean);

        // Auto-send upon 1.2s silence
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const spoken = transcriptRef.current.trim();
          if (spoken.length > 0 && botStateRef.current === 'listening') {
            triggerSend(spoken);
          }
        }, 1200);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e.error);
        if (e.error === 'not-allowed') {
          setIsMicActive(false);
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
    }
  };

  const stopListening = () => {
    setIsMicActive(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
  };

  const toggleMic = () => {
    if (isMicActive) {
      stopListening();
      setBotState('listening');
    } else {
      setHasRequestedMic(true);
      if (synthRef.current) synthRef.current.cancel();
      startListening();
    }
  };

  const triggerSend = (textToSend: string) => {
    stopListening();
    handleSendMessage(textToSend);
  };

  // Initial Greeting when arriving at the Chatbox
  useEffect(() => {
    let unmounted = false;

    const initGreeting = async () => {
      try {
        const res = await sendVoiceAssistantChat(
          [{ role: 'user', content: 'HELLO_START' }],
          lat ?? undefined,
          lng ?? undefined
        );

        if (unmounted) return;

        const welcomeText = res.reply || "Crisis Command Emergency AI here. Tell me what happened near you and what help you need.";
        const entry: ChatEntry = {
          id: 'welcome',
          role: 'assistant',
          content: welcomeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages([entry]);
        messagesDataRef.current = [{ role: 'assistant', content: welcomeText }];
        setBotState('speaking');

        speak(welcomeText, () => {
          if (!unmounted && isMicActiveRef.current) {
            startListening();
          }
        });
      } catch (err) {
        if (unmounted) return;
        const fallbackText = "Crisis Command AI Dispatcher online. Tell me what emergency occurred near you or what happened to you.";
        const entry: ChatEntry = {
          id: 'welcome-fb',
          role: 'assistant',
          content: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages([entry]);
        messagesDataRef.current = [{ role: 'assistant', content: fallbackText }];
        setBotState('listening');
      }
    };

    initGreeting();

    return () => {
      unmounted = true;
      stopListening();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  // Handle User Message (Spoken or Typed)
  const handleSendMessage = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText) return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setCurrentTranscript('');
    transcriptRef.current = '';
    setInputText('');

    // Append user message to UI
    const userEntry: ChatEntry = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedUI = [...messages, userEntry];
    setMessages(updatedUI);

    const updatedData: VoiceChatMessage[] = [
      ...messagesDataRef.current,
      { role: 'user', content: cleanText }
    ];
    messagesDataRef.current = updatedData;
    setBotState('thinking');

    try {
      const response: VoiceChatResponse = await sendVoiceAssistantChat(
        updatedData,
        lat ?? undefined,
        lng ?? undefined,
        false,
        incidentIdRef.current,
        reportIdRef.current
      );

      // Update extracted incident telemetry
      setIncidentType(response.incident_type);
      setSeverity(response.severity);
      setUrgency(response.urgency);
      setPeopleAffected(response.people_affected);
      setRequiredResources(response.required_resources);
      if (response.extracted_location) {
        setExtractedLocation(response.extracted_location);
      }

      if (response.incident_id) {
        incidentIdRef.current = response.incident_id;
      }
      if (response.report_id) {
        reportIdRef.current = response.report_id;
      }

      const isDispatchedNow = Boolean(response.dispatched || response.transition_to_command);

      const aiEntry: ChatEntry = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isDispatchNotice: isDispatchedNow,
      };

      const withAi = [...updatedUI, aiEntry];
      setMessages(withAi);
      messagesDataRef.current = [
        ...updatedData,
        { role: 'assistant', content: response.reply }
      ];

      // Speak response aloud
      speak(response.reply, () => {
        if (isMicActiveRef.current && !isDispatchedNow) {
          startListening();
        }
      });

      // =========================================================================
      // INTAKE SATISFIED: AUTOMATIC INTERFACE TRANSITION TO COMMAND CENTER
      // =========================================================================
      if (isDispatchedNow) {
        setIsSatisfied(true);
        const incId = response.incident_id || incidentIdRef.current || 'INC-LIVE';
        setDispatchedIncidentId(incId);

        // Initiate automatic transition countdown (3 seconds)
        let timer = 3;
        setCountdown(timer);

        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = setInterval(() => {
          timer -= 1;
          setCountdown(timer);

          if (timer <= 0) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            // Automatic switch to Command Center interface with zero layout changes
            navigate(`/command?incidentId=${incId}`);
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Error in emergency chatbox:', err);
      const fallbackReply = "I have recorded your situation and emergency dispatch is tracking your status. Are you in a safe position right now?";
      const aiEntry: ChatEntry = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...updatedUI, aiEntry]);
      speak(fallbackReply);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      handleSendMessage(inputText);
    }
  };

  const handleImmediateTransition = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    const target = dispatchedIncidentId ? `/command?incidentId=${dispatchedIncidentId}` : '/command';
    navigate(target);
  };

  const handleStayInChat = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCountdown(null);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white leading-tight">
                Emergency Response AI Chatbox
              </h1>
              <span className={`w-2 h-2 rounded-full ${isSatisfied ? 'bg-emerald-400 animate-ping' : 'bg-red-400 animate-pulse'}`} />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {isSatisfied ? 'Dispatch authorized & tracked' : 'Situation-aware crisis intake & first-aid guidance'}
            </p>
          </div>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center gap-2">
          {lat && lng && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono text-[11px]">
              <Navigation className="w-3 h-3 text-blue-400" />
              <span>GPS: {lat.toFixed(4)}, {lng.toFixed(4)}</span>
            </div>
          )}

          <button
            onClick={() => {
              if (!isMuted) synthRef.current?.cancel();
              setIsMuted(!isMuted);
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
            title={isMuted ? "Unmute Voice" : "Mute Voice"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <Link
            to="/command"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
          >
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Tactical Command</span>
          </Link>
        </div>
      </div>

      {/* Main Content: Chat Stream + Telemetry Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Conversational Chat Stream */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          {/* Chat Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((m) => {
              const isAssistant = m.role === 'assistant';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      {isAssistant ? (
                        <>
                          <ShieldAlert className="w-3 h-3 text-red-400" />
                          <span>Crisis Dispatcher AI</span>
                        </>
                      ) : (
                        <>
                          <Users className="w-3 h-3 text-blue-400" />
                          <span>You (Distress Caller)</span>
                        </>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{m.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-sm ${
                      isAssistant
                        ? m.isDispatchNotice
                          ? 'bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-500/40 text-slate-100'
                          : 'bg-slate-900 border border-slate-800 text-slate-200'
                        : 'bg-blue-600 text-white rounded-br-sm'
                    }`}
                  >
                    {m.content}

                    {m.isDispatchNotice && (
                      <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs text-emerald-400">
                        <span className="flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Emergency Response Dispatched
                        </span>
                        <span className="text-[11px] opacity-80">Sirens Rolling</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* AI Thinking Indicator */}
            {botState === 'thinking' && (
              <div className="flex items-start gap-2">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span>Dispatcher assessing situation & prioritizing units...</span>
                </div>
              </div>
            )}

            {/* Live Speech Recognition Transcript Preview */}
            {currentTranscript && (
              <div className="flex items-end justify-end">
                <div className="bg-slate-800/80 border border-blue-500/40 rounded-2xl px-4 py-2.5 text-xs text-blue-200 max-w-[80%] flex items-center justify-between gap-3">
                  <span className="italic truncate">"{currentTranscript}"</span>
                  <button
                    onClick={() => triggerSend(currentTranscript)}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-semibold uppercase shrink-0"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reply Situation Chips */}
          <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/70 overflow-x-auto flex items-center gap-2 text-xs shrink-0">
            <span className="text-[10px] uppercase font-semibold text-slate-400 whitespace-nowrap">
              Quick Report:
            </span>
            {EMERGENCY_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(preset.text)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] whitespace-nowrap transition cursor-pointer"
              >
                <preset.icon className="w-3 h-3 text-orange-400" />
                <span>{preset.label}</span>
              </button>
            ))}
            {QUICK_RESPONSES.map((q, idx) => (
              <button
                key={`q-${idx}`}
                onClick={() => handleSendMessage(q)}
                className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700 border border-slate-750 text-slate-400 hover:text-slate-200 text-[11px] whitespace-nowrap transition cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Bottom Dual Input Bar (Voice Mic + Text Input) */}
          <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 shrink-0">
            <form onSubmit={handleManualSubmit} className="flex items-center gap-2 max-w-4xl mx-auto">
              {/* Mic Button */}
              <button
                type="button"
                onClick={toggleMic}
                className={`relative p-3 rounded-xl transition duration-200 flex items-center justify-center shrink-0 cursor-pointer ${
                  isMicActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/30 animate-pulse'
                    : botState === 'speaking'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
                title={isMicActive ? "Mute Microphone" : "Tap to Speak"}
              >
                {isMicActive ? <Mic className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5" />}
                {isMicActive && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
                )}
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Give instruction what happened near you, answer questions, or ask for help..."
                className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Live Emergency Triage Telemetry */}
        <div className="w-full lg:w-80 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto shrink-0 space-y-4">
          <div className="space-y-4">
            <div>
              <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                Live Intake Telemetry
              </h2>
              <p className="text-[11px] text-slate-400 leading-tight">
                Real-time analysis extracted directly from your conversation.
              </p>
            </div>

            {/* Incident Classification Card */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Classification:</span>
                <span className="font-semibold text-white">{incidentType}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Assessed Severity:</span>
                <SeverityBadge severity={severity} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Assessed Urgency:</span>
                <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${
                  urgency === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  urgency === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                  'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {urgency}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">People In Danger:</span>
                <span className="font-mono text-slate-200 font-medium">{peopleAffected} individual{peopleAffected === 1 ? '' : 's'}</span>
              </div>

              <div className="pt-2 border-t border-slate-700/60">
                <span className="text-slate-400 block mb-1">Allocated Fleet Response:</span>
                <div className="flex flex-wrap gap-1">
                  {requiredResources.map((res, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-750 text-[10px] text-blue-300 font-mono">
                      {res.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {extractedLocation && (
                <div className="pt-2 border-t border-slate-700/60 flex items-start gap-1.5 text-slate-300 text-[11px]">
                  <Navigation className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span className="truncate">{extractedLocation}</span>
                </div>
              )}
            </div>

            {/* Intake Stage Tracker */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Intake Progress
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 border border-slate-750">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-200">1. Emergency Reported</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 border border-slate-750">
                  <CheckCircle2 className={`w-4 h-4 ${messages.length > 2 ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className={messages.length > 2 ? 'text-slate-200' : 'text-slate-400'}>
                    2. Hazard & Occupant Safety
                  </span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 border border-slate-750">
                  <CheckCircle2 className={`w-4 h-4 ${isSatisfied ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className={isSatisfied ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                    3. Units Dispatched & Routed
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Launch to Command Center Button */}
          <div className="pt-2">
            <button
              onClick={handleImmediateTransition}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Go to Command Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AUTOMATIC INTERFACE CHANGE MODAL (ACTIVE UPON CHATBOX SATISFACTION)      */}
      {/* ========================================================================= */}
      {isSatisfied && countdown !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5 animate-in fade-in zoom-in duration-200">
            {/* Top Icon */}
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Emergency Intake Satisfied
              </span>
              <h2 className="text-xl font-bold text-white">
                Dispatch Units Rolling
              </h2>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                First responders have been authorized and are navigating via real road routes with lights & sirens.
              </p>
            </div>

            {/* Incident Details Card */}
            <div className="bg-slate-800/60 rounded-xl p-3.5 text-left space-y-2 text-xs border border-slate-700/60">
              <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
                <span className="text-slate-400">Incident Code:</span>
                <span className="font-mono text-emerald-400 font-semibold">{dispatchedIncidentId || 'INC-ACTIVE'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Emergency Type:</span>
                <span className="font-medium text-slate-200">{incidentType}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Dispatched Units:</span>
                <span className="font-medium text-blue-400">{requiredResources.map(r => r.replace('_', ' ')).join(', ')}</span>
              </div>
            </div>

            {/* Countdown / Transfer Notification */}
            <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-3 flex items-center justify-center gap-3">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-xs font-medium text-blue-200">
                Changing to Tactical Command Center in <span className="font-bold text-white text-sm">{countdown}s</span>...
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleImmediateTransition}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Open Command Center Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleStayInChat}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
              >
                Stay on Line
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
