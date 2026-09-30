import React, { useState } from 'react';
import { AlertTriangle, Send, MapPin, Loader2, Phone, Flame, Activity, Car, CheckCircle2, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createTextReport, createVoiceReport } from '../lib/api/reports';
import { useLocation } from '../hooks/useLocation';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import ChatGPTVoiceBot from '../components/voice/ChatGPTVoiceBot';
import type { IncidentReport } from '../types';

export default function Report() {
  const [mode, setMode] = useState<'idle' | 'text' | 'voice' | 'submitted'>('idle');
  const [text, setText] = useState('');
  const [result, setResult] = useState<IncidentReport | null>(null);
  const { lat, lng, requestLocation } = useLocation();
  const { isRecording, audioBlob, transcript, duration, startRecording, stopRecording, clearRecording } = useVoiceRecorder();

  const textMutation = useMutation({
    mutationFn: () => createTextReport(text, lat ?? undefined, lng ?? undefined),
    onSuccess: (data) => { setResult(data); setMode('submitted'); },
  });

  const voiceMutation = useMutation({
    mutationFn: () => createVoiceReport(audioBlob!, lat ?? undefined, lng ?? undefined, transcript),
    onSuccess: (data) => { setResult(data); setMode('submitted'); },
  });

  const applyEmergencyTemplate = (category: string) => {
    setText(`Emergency: ${category} reported near my location. Please send assistance.`);
    setMode('text');
  };

  if (mode === 'submitted' && result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            Emergency Report Logged
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Your emergency report has been received and dispatch units are being coordinated.
          </p>

          <div className="bg-slate-800/50 rounded-xl p-3.5 text-left space-y-2 text-xs border border-slate-750">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
              <span className="text-slate-400">Report ID:</span>
              <span className="font-mono text-slate-200 font-medium">{result.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Incident Type:</span>
              <span className="font-medium text-slate-200">{result.preliminary_type || 'General Emergency'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Triage Confidence:</span>
              <span className="text-emerald-400 font-medium">{(result.ai_confidence * 100).toFixed(0)}%</span>
            </div>
            {result.extracted_location && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Location:</span>
                <span className="text-slate-300 truncate max-w-[200px]">{result.extracted_location}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2.5 mt-5">
            <Link
              to="/command"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5"
            >
              <Shield className="w-4 h-4" /> View in Command Center
            </Link>
            <button 
              onClick={() => { setMode('idle'); setResult(null); setText(''); clearRecording(); }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              New Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 relative">
      {mode === 'idle' && (
        <div className="flex flex-col items-center gap-6 max-w-lg text-center">
          {/* Main SOS Trigger Button */}
          <div className="relative group my-2">
            <button 
              onClick={() => { requestLocation(); setMode('voice'); }}
              className="w-44 h-44 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 flex flex-col items-center justify-center text-white shadow-lg transition duration-200 cursor-pointer"
            >
              <Phone className="w-10 h-10 mb-1.5" />
              <span className="text-3xl font-bold tracking-wider">SOS</span>
              <span className="text-[11px] font-medium opacity-90 mt-0.5">Tap to Speak</span>
            </button>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Emergency Assistance
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-sm">
              Press the SOS button to speak directly with the AI dispatcher, or select an incident type below.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button 
              onClick={() => applyEmergencyTemplate('Structure Fire')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Fire</span>
            </button>
            <button 
              onClick={() => applyEmergencyTemplate('Medical Emergency')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition"
            >
              <Activity className="w-3.5 h-3.5 text-red-400" />
              <span>Medical</span>
            </button>
            <button 
              onClick={() => applyEmergencyTemplate('Vehicle Collision')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition"
            >
              <Car className="w-3.5 h-3.5 text-blue-400" />
              <span>Collision</span>
            </button>
          </div>

          {/* Text Report Option Toggle */}
          <button 
            onClick={() => setMode('text')}
            className="text-xs text-slate-400 hover:text-slate-200 transition underline underline-offset-4"
          >
            Or submit a written report
          </button>
        </div>
      )}

      {/* Text Report Mode */}
      {mode === 'text' && (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Written Emergency Report</h2>
            <button 
              onClick={() => setMode('idle')}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Back
            </button>
          </div>

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            placeholder="Describe what happened, where you are, and if anyone is injured..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            autoFocus
          />

          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{lat && lng ? `${lat.toFixed(3)}, ${lng.toFixed(3)}` : 'GPS location will attach'}</span>
            </div>
          </div>

          <button
            onClick={() => textMutation.mutate()}
            disabled={!text.trim() || textMutation.isPending}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {textMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{textMutation.isPending ? 'Submitting Report...' : 'Send Emergency Report'}</span>
          </button>
        </div>
      )}

      {/* Voice Bot Modal */}
      {mode === 'voice' && (
        <ChatGPTVoiceBot 
          lat={lat ?? undefined} 
          lng={lng ?? undefined} 
          onClose={() => {
            if (result) {
              setMode('submitted');
            } else {
              setMode('idle');
            }
          }} 
          onDispatched={(resp) => {
            if (resp.report_id) {
              setResult({
                id: resp.report_id,
                raw_text: text || 'Voice SOS Emergency Report',
                preliminary_type: resp.incident_type || 'General Emergency',
                ai_confidence: 0.95,
                extracted_location: resp.extracted_location || (lat != null && lng != null ? `${lat.toFixed(3)}, ${lng.toFixed(3)}` : undefined),
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
              } as IncidentReport);
            }
          }}
        />
      )}
    </div>
  );
}
