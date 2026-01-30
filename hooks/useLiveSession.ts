
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { ConnectionState, TranscriptItem } from '../types.ts';
import { MODEL_NAME, VOICE_NAME } from '../constants.ts';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils.ts';

interface UseLiveSessionProps {
  systemInstruction: string;
  onUserTurnComplete: (text: string) => void;
}

export const useLiveSession = ({ systemInstruction, onUserTurnComplete }: UseLiveSessionProps) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState<{ user: number; model: number }>({ user: 0, model: 0 });
  const [sessionTime, setSessionTime] = useState<number>(0);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  
  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');
  const lastUserVolumeCueTimeRef = useRef(0);
  const modelResponseTimeoutRef = useRef<number | null>(null);

  const playTone = (frequency: number, duration: number, context: AudioContext | null) => {
    if (!context) return;
    try {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      gainNode.gain.setValueAtTime(0.08, context.currentTime); // Subtle volume
      gainNode.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + duration);
      
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch (e) {
      console.warn("Could not play tone", e);
    }
  };

  // Effect to manage the session timer
  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED && !isTimerPaused) {
      if (!timerIntervalRef.current) {
        timerIntervalRef.current = window.setInterval(() => {
          setSessionTime(prev => prev + 1);
        }, 1000);
      }
    } else {
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
      }
    };
  }, [connectionState, isTimerPaused]);


  const disconnect = useCallback(async () => {
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.warn("Error closing session", e);
      }
    }
    if (modelResponseTimeoutRef.current) {
      clearTimeout(modelResponseTimeoutRef.current);
      modelResponseTimeoutRef.current = null;
    }

    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch {}
    });
    sourcesRef.current.clear();

    if (inputAudioContextRef.current) {
      await inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      await outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    sessionPromiseRef.current = null;
    setConnectionState(ConnectionState.DISCONNECTED);
    setVolume({ user: 0, model: 0 });
  }, []);

  const connect = useCallback(async () => {
    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);
      setSessionTime(0);
      setIsTimerPaused(false);

      let apiKey = '';
      try {
        apiKey = process.env.API_KEY || '';
      } catch (e) {
        console.error("Error accessing process.env", e);
      }

      if (!apiKey) {
        throw new Error("API Key not found. Please check your environment configuration.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      
      nextStartTimeRef.current = 0;
      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (e) {
        throw new Error("Microphone access denied. Please allow microphone permissions.");
      }

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            
            // Programmatically kick-start the session by sending a short silent audio clip.
            // This simulates an initial user turn, prompting the AI to start speaking
            // immediately as per its system instructions.
            sessionPromise.then(session => {
              const silentBuffer = new Float32Array(1600); // 100ms of silence at 16kHz
              const silentBlob = createBlob(silentBuffer);
              session.sendRealtimeInput({ media: silentBlob });
            });
            
            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(prev => ({ ...prev, user: Math.min(1, rms * 5) }));
              
              const now = Date.now();
              if (rms > 0.8 && now - lastUserVolumeCueTimeRef.current > 1000) {
                playTone(200, 0.1, outputAudioContextRef.current);
                lastUserVolumeCueTimeRef.current = now;
              }

              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: any) => {
             if (modelResponseTimeoutRef.current) {
                clearTimeout(modelResponseTimeoutRef.current);
                modelResponseTimeoutRef.current = null;
              }

             if (message.serverContent?.outputTranscription) {
                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
              } else if (message.serverContent?.inputTranscription) {
                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
              }

              if (message.serverContent?.turnComplete) {
                const userText = currentInputTranscriptionRef.current;
                const modelText = currentOutputTranscriptionRef.current;
                
                if (userText.trim()) {
                  onUserTurnComplete(userText.trim());
                  modelResponseTimeoutRef.current = window.setTimeout(() => {
                    playTone(440, 0.2, outputAudioContextRef.current);
                  }, 5000);
                }

                if (userText.trim() || modelText.trim()) {
                  setTranscript(prev => [
                    ...prev,
                    ...(userText.trim() ? [{ id: Date.now() + '-user', speaker: 'user' as const, text: userText.trim(), timestamp: new Date() }] : []),
                     ...(modelText.trim() ? [{ id: Date.now() + '-model', speaker: 'model' as const, text: modelText.trim(), timestamp: new Date() }] : [])
                  ]);
                }
                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
              }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              setVolume(prev => ({ ...prev, model: 0.5 + Math.random() * 0.5 })); 
              setTimeout(() => setVolume(prev => ({ ...prev, model: 0 })), 200); 

              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              currentOutputTranscriptionRef.current = ''; 
            }
          },
          onerror: (e: any) => {
            console.error(e);
            setError("Connection Error: " + (e.message || "Unknown error"));
            setConnectionState(ConnectionState.ERROR);
            disconnect();
          },
          onclose: () => {
            setConnectionState(ConnectionState.DISCONNECTED);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } }
          },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });
      
      sessionPromise.catch(e => {
          console.error("Session connection failed", e);
          setError("Connection failed: " + (e.message || "Network Error"));
          setConnectionState(ConnectionState.ERROR);
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect");
      setConnectionState(ConnectionState.ERROR);
    }
  }, [disconnect, systemInstruction, onUserTurnComplete]);

  const pauseTimer = useCallback(() => setIsTimerPaused(true), []);
  const resumeTimer = useCallback(() => setIsTimerPaused(false), []);
  const resetTimer = useCallback(() => {
    setSessionTime(0);
  }, []);

  useEffect(() => () => { disconnect(); }, [disconnect]);

  return { 
    connect, 
    disconnect, 
    connectionState, 
    transcript, 
    setTranscript, 
    error, 
    volume, 
    sessionTime,
    isTimerPaused,
    pauseTimer,
    resumeTimer,
    resetTimer
  };
};
