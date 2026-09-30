import { useState, useRef, useCallback } from 'react';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const transcriptBuffer = useRef('');

  const startRecording = useCallback(async () => {
    try {
      transcriptBuffer.current = '';
      setTranscript('');

      // Start Browser Speech Recognition in parallel
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let fullText = '';
            for (let i = 0; i < event.results.length; ++i) {
              fullText += event.results[i][0].transcript + ' ';
            }
            const clean = fullText.trim();
            transcriptBuffer.current = clean;
            setTranscript(clean);
          };

          recognition.onerror = (err: any) => {
            console.warn('Speech recognition during recording warning:', err.error);
          };

          recognition.start();
        } catch (e) {
          console.warn('SpeechRecognition failed to start:', e);
        }
      }

      // Start MediaRecorder for audio blob
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunks.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunks.current, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
        if (timer.current) clearInterval(timer.current);
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setIsRecording(true);
      setDuration(0);
      timer.current = window.setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e) { 
      console.error('Mic access denied:', e); 
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  }, []);

  const clearRecording = useCallback(() => { 
    setAudioBlob(null); 
    setDuration(0); 
    setTranscript('');
    transcriptBuffer.current = '';
  }, []);

  return { isRecording, audioBlob, transcript, duration, startRecording, stopRecording, clearRecording };
}
