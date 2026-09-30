import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mic, MicOff, Send, Volume2, VolumeX, Shield, ShieldAlert, CheckCircle2, 
  AlertTriangle, Flame, Activity, Car, ArrowRight, Loader2, Navigation, 
  Clock, Users, RefreshCw, LifeBuoy, ArrowUp, AlertCircle, PhoneCall,
  Sparkles, Compass, Bell, MessageSquare, Plus, ChevronDown
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
  { label: 'Structure Fire', icon: Flame, text: 'A fire broke out in a residential building near me. Thick black smoke is spreading quickly.' },
  { label: 'Vehicle Crash', icon: Car, text: 'Two-car collision at the main intersection. Two people are injured and bleeding.' },
  { label: 'Medical Alert', icon: Activity, text: 'An elderly person collapsed and is unconscious with shallow breathing.' },
  { label: 'Gas Leak', icon: AlertTriangle, text: 'Strong smell of LPG gas leaking inside the residential block. Hissing sound heard.' },
];

const QUICK_RESPONSES = [
  "Everyone evacuated outside safely",
  "Two people injured and bleeding",
  "Nobody is trapped inside",
  "Yes, please dispatch emergency units now",
  "What first-aid should I perform right now?",
  "How long will the responders take to arrive?"
];

// Clean text to avoid robotic TTS pronouncing markdown syntax
const cleanTextForHumanSpeech = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s?/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/`{1,3}.*?`{1,3}/gs, '')
    .replace(/[•\-\*]\s+/g, '')
    .replace(/\n+/g, ' ')
    .trim();
};

export default function Report() {
  const navigate = useNavigate();
  const { lat, lng, requestLocation } = useLocation();

  // Chat & Voice State
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [botState, setBotState] = useState<BotState>('connecting');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [hasRequestedMic, setHasRequestedMic] = useState(false);
  const [voiceName, setVoiceName] = useState<string>('Natural Voice');

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

  // Synchronous Refs
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

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, botState, currentTranscript]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Select human-sounding voice
  const selectHumanVoice = (synth: SpeechSynthesis): SpeechSynthesisVoice | null => {
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;

    const scoreVoice = (v: SpeechSynthesisVoice) => {
      let score = 0;
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      if (!lang.startsWith('en')) return -100;
      if (name.includes('natural') || name.includes('online')) score += 50;
      if (name.includes('neural')) score += 40;
      if (name.includes('enhanced') || name.includes('premium')) score += 35;
      if (name.includes('google us english') || name.includes('google uk english female')) score += 30;
      if (name.includes('samantha') || name.includes('ava') || name.includes('karen') || name.includes('daniel')) score += 25;
      if (name.includes('jenny') || name.includes('guy') || name.includes('aria')) score += 20;
      return score;
    };

    const sorted = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    const chosen = sorted[0] || null;
    if (chosen) setVoiceName(chosen.name);
    return chosen;
  };

  // Human-like Web Speech Text-to-Speech
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

      const humanText = cleanTextForHumanSpeech(textToSpeak);
      const utterance = new SpeechSynthesisUtterance(humanText);
      currentUtteranceRef.current = utterance;
      
      // Calibrated human pacing: relaxed rate, natural pitch
      utterance.rate = 0.96;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const chosenVoice = selectHumanVoice(synthRef.current);
      if (chosenVoice) utterance.voice = chosenVoice;

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

      // Safety timeout
      const estTime = Math.max(2500, (humanText.split(' ').length / 2.0) * 1000 + 1500);
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

  // Speech-to-Text Recognition
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

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
          setIsMicActive(false);
        }
      };

      recognition.onend = () => {
        const spoken = transcriptRef.current.trim();
        if (spoken.length > 0 && botStateRef.current === 'listening') {
          triggerSend(spoken);
        } else if (isMicActiveRef.current && botStateRef.current === 'listening') {
          try { recognition.start(); } catch {}
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

  // Initial greeting
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

        const greetingText = res.reply || "CrisisSync AI Dispatcher online. I am right here with you. Take a deep breath and tell me what is happening.";
        const initEntry: ChatEntry = {
          id: 'msg-0',
          role: 'assistant',
          content: greetingText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages([initEntry]);
        messagesDataRef.current = [{ role: 'assistant', content: greetingText }];
        setBotState('listening');
      } catch {
        if (unmounted) return;
        const fallbackText = "CrisisSync AI Dispatcher online. I am right here with you. Take a deep breath and tell me what is happening.";
        setMessages([{
          id: 'msg-0',
          role: 'assistant',
          content: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        messagesDataRef.current = [{ role: 'assistant', content: fallbackText }];
        setBotState('listening');
      }
    };

    initGreeting();
    return () => {
      unmounted = true;
      if (synthRef.current) synthRef.current.cancel();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // Send Message Handler
  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = (textOverride !== undefined ? textOverride : inputText).trim();
    if (!textToSend) return;

    setInputText('');
    setCurrentTranscript('');
    transcriptRef.current = '';

    const userEntry: ChatEntry = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messagesDataRef.current, { role: 'user' as const, content: textToSend }];
    messagesDataRef.current = newHistory;
    setMessages(prev => [...prev, userEntry]);
    setBotState('thinking');

    try {
      const res: VoiceChatResponse = await sendVoiceAssistantChat(
        newHistory,
        lat ?? undefined,
        lng ?? undefined,
        undefined,
        incidentIdRef.current,
        reportIdRef.current
      );

      if (res.incident_id) incidentIdRef.current = res.incident_id;
      if (res.report_id) reportIdRef.current = res.report_id;
      if (res.incident_type) setIncidentType(res.incident_type);
      if (res.severity) setSeverity(res.severity);
      if (res.urgency) setUrgency(res.urgency);
      if (res.people_affected) setPeopleAffected(res.people_affected);
      if (res.required_resources) setRequiredResources(res.required_resources);
      if (res.extracted_location) setExtractedLocation(res.extracted_location);

      const botEntry: ChatEntry = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isDispatchNotice: res.dispatched
      };

      messagesDataRef.current.push({ role: 'assistant', content: res.reply });
      setMessages(prev => [...prev, botEntry]);

      // Speak response with natural human voice
      speak(res.reply, () => {
        if (isMicActiveRef.current) {
          startListening();
        }
      });

      // Handle dispatch satisfaction transition
      if (res.dispatched || res.incident_id) {
        setIsSatisfied(true);
        setDispatchedIncidentId(res.incident_id || 'INC-LIVE');

        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        let sec = 5;
        setCountdown(sec);
        countdownTimerRef.current = setInterval(() => {
          sec -= 1;
          if (sec <= 0) {
            clearInterval(countdownTimerRef.current);
            navigate(`/command?incidentId=${res.incident_id || ''}`);
          } else {
            setCountdown(sec);
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackReply = "I have noted this emergency and emergency responders are actively preparing. Please stay safe and follow guidance.";
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setBotState('listening');
    }
  };

  const handleManualTransition = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    navigate(`/command?incidentId=${dispatchedIncidentId || ''}`);
  };

  const handleResetSession = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (synthRef.current) synthRef.current.cancel();
    setMessages([]);
    messagesDataRef.current = [];
    setIsSatisfied(false);
    setDispatchedIncidentId(null);
    setCountdown(null);
    incidentIdRef.current = undefined;
    reportIdRef.current = undefined;
    const init = "CrisisSync AI Dispatcher online. I am right here with you. Take a deep breath and tell me what is happening.";
    setMessages([{
      id: 'msg-0',
      role: 'assistant',
      content: init,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    messagesDataRef.current = [{ role: 'assistant', content: init }];
    setBotState('listening');
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      
      {/* CHATGPT-STYLE SIDEBAR (Left) */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col justify-between p-3.5 shrink-0">
        <div className="space-y-4">
          
          {/* New Chat Button */}
          <button
            onClick={handleResetSession}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-between transition shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-slate-600" />
              <span>New Emergency Intake</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">⌘K</span>
          </button>

          {/* Active Intake Telemetry Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Telemetry</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="text-xs">
              <span className="text-slate-400 block text-[10px]">Type</span>
              <span className="font-bold text-slate-900">{incidentType}</span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
              <div>
                <span className="text-slate-400 block text-[10px]">Severity</span>
                <SeverityBadge severity={severity} />
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px]">Urgency</span>
                <span className="font-bold text-rose-600">{urgency}</span>
              </div>
            </div>

            {dispatchedIncidentId && (
              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-[10px] text-slate-400 block">Incident ID</span>
                <span className="font-mono text-xs font-bold text-blue-600">#{dispatchedIncidentId}</span>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="space-y-1 text-xs font-medium">
            <Link
              to="/passerby"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
            >
              <Bell className="w-4 h-4 text-rose-500" />
              <span>100m Passerby Alerts</span>
            </Link>

            <Link
              to="/nearby"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
            >
              <Compass className="w-4 h-4 text-amber-500" />
              <span>Nearby Help Outlets</span>
            </Link>

            <Link
              to="/command"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
            >
              <Shield className="w-4 h-4 text-blue-500" />
              <span>Command Center</span>
            </Link>
          </div>
        </div>

        {/* Emergency Hotline 112 */}
        <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-rose-400">
            <span>National Helpline</span>
            <span>24/7</span>
          </div>
          <div className="text-2xl font-black">112</div>
          <a
            href="tel:112"
            className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
          >
            <PhoneCall className="w-3 h-3" />
            <span>Call 112</span>
          </a>
        </div>
      </aside>

      {/* CHATGPT CONVERSATIONAL MAIN AREA */}
      <main className="flex-1 flex flex-col justify-between overflow-hidden bg-white">
        
        {/* Top Floating Bar */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-white/90 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">CrisisSync AI</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200">
                  Emergency GPT &middot; Human-Paced Voice
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* GPS Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs">
              <Navigation className="w-3 h-3 text-red-500" />
              <span>{lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'GPS Active'}</span>
            </div>

            {/* Mute/Unmute */}
            <button
              onClick={() => {
                if (isMuted) {
                  setIsMuted(false);
                  if (synthRef.current?.paused) synthRef.current.resume();
                } else {
                  setIsMuted(true);
                  if (synthRef.current) synthRef.current.cancel();
                }
              }}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title={isMuted ? 'Unmute voice' : 'Mute voice'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
            </button>

            {/* Tactical Command Transition */}
            {isSatisfied && (
              <button
                onClick={handleManualTransition}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition animate-pulse"
              >
                <span>Command Center ({countdown ?? 0}s)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">

            {/* Empty State with ChatGPT-style Preset Cards */}
            {messages.length <= 1 && (
              <div className="text-center py-6 sm:py-10 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-xs border border-red-100">
                  <Activity className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    How can CrisisSync AI assist you?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-lg mx-auto">
                    Speak or type. The system provides immediate first-aid instructions, alerts nearby passersby within 100m, and coordinates emergency dispatch.
                  </p>
                </div>

                {/* 4 Preset Prompt Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto text-left pt-2">
                  {EMERGENCY_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(p.text)}
                      className="p-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-2xl transition shadow-2xs group text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <p.icon className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-xs text-slate-800">{p.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {p.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages Feed */}
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div 
                  key={m.id} 
                  className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Activity className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`space-y-2 max-w-[85%] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-4 rounded-3xl text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-slate-900 text-white rounded-tr-xs'
                          : 'bg-[#F1F5F9] text-slate-900 rounded-tl-xs border border-slate-200/80 shadow-2xs'
                      }`}
                    >
                      <p className="whitespace-pre-line font-normal">{m.content}</p>

                      {/* Dispatch Card Badge */}
                      {m.isDispatchNotice && (
                        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/80 rounded-xl p-2.5 text-emerald-800">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="font-bold text-xs">Response Units Dispatched</span>
                          </div>
                          <Link 
                            to="/command"
                            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                          >
                            <span>Inspect Route on Map</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 px-1 text-[10px] text-slate-400">
                      <span>{m.timestamp}</span>
                      {!isUser && (
                        <button
                          onClick={() => speak(m.content)}
                          className="hover:text-slate-600 transition"
                          title="Replay voice"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Interim Transcript while speaking */}
            {currentTranscript && (
              <div className="flex gap-3.5 justify-end">
                <div className="bg-slate-200/70 text-slate-600 rounded-3xl rounded-tr-xs p-4 text-xs italic border border-dashed border-slate-300 animate-pulse">
                  {currentTranscript}...
                </div>
              </div>
            )}

            {/* Dynamic Voice Mode Visualizer */}
            {botState === 'speaking' && (
              <div className="flex items-center justify-center gap-1.5 py-2 text-red-600">
                <span className="w-1.5 h-4 rounded-full bg-red-600 animate-pulse" />
                <span className="w-1.5 h-7 rounded-full bg-red-500 animate-pulse delay-75" />
                <span className="w-1.5 h-9 rounded-full bg-red-600 animate-pulse delay-150" />
                <span className="w-1.5 h-6 rounded-full bg-red-500 animate-pulse delay-100" />
                <span className="w-1.5 h-3 rounded-full bg-red-600 animate-pulse" />
                <span className="text-xs font-semibold text-slate-500 ml-2">Speaking aloud ({voiceName})...</span>
              </div>
            )}

            {botState === 'thinking' && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                <span>CrisisSync AI analyzing emergency context...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* INPUT COMPONENT (ChatGPT Style) */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <div className="max-w-3xl mx-auto space-y-3">
            
            {/* Quick Response Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {QUICK_RESPONSES.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip)}
                  className="px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-xs font-medium whitespace-nowrap transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* ChatGPT-style Pill Input Bar */}
            <div className="relative bg-white border border-slate-300 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-900/10 rounded-3xl p-1.5 shadow-sm transition flex items-center gap-2">
              
              {/* Mic Button with Pulsing Wave */}
              <button
                type="button"
                onClick={toggleMic}
                className={`p-2.5 rounded-full transition flex items-center justify-center shrink-0 ${
                  isMicActive 
                    ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-500/30' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title={isMicActive ? 'Stop listening' : 'Start voice mode'}
              >
                {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-slate-500" />}
              </button>

              {/* Text Area */}
              <input
                type="text"
                placeholder={isMicActive ? "Listening to your voice..." : "Type your emergency, ask what to do, or speak aloud..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 bg-transparent px-2 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim()}
                className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-white flex items-center justify-center transition shrink-0"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-400">
              CrisisSync AI coordinates emergency responders and 100m passerby alerts. In critical life peril, dial <strong>112</strong> immediately.
            </p>
          </div>
        </div>

      </main>

    </div>
  );
}
