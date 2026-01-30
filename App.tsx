

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Header } from './components/Header.tsx';
import { AudioVisualizer } from './components/AudioVisualizer.tsx';
import { Transcript } from './components/Transcript.tsx';
import { useLiveSession } from './hooks/useLiveSession.ts';
import { ConnectionState } from './types.ts';
import { Power, AlertCircle, PlayCircle, BrainCircuit, Loader2, PauseCircle, Play, RotateCw } from 'lucide-react';
import { SYSTEM_INSTRUCTION as defaultSystemInstruction } from './constants.ts';

export default function App() {
  const [systemInstruction, setSystemInstruction] = useState<string>(defaultSystemInstruction);
  const [isLearningMode, setIsLearningMode] = useState<boolean>(false);
  const [learningInstructions, setLearningInstructions] = useState<string[]>([]);
  const [isUpdatingInstruction, setIsUpdatingInstruction] = useState<boolean>(false);
  const [sessionDuration, setSessionDuration] = useState<number>(45 * 60); // 45 minutes in seconds

  const dynamicSystemInstruction = useMemo(() => {
    return defaultSystemInstruction.replace(
      '45-Minute',
      `${Math.round(sessionDuration / 60)}-Minute`
    );
  }, [sessionDuration]);

  useEffect(() => {
    const saved = localStorage.getItem('gans-ai-system-instruction');
    if (saved) {
      setSystemInstruction(saved);
    }
  }, []);

  // FIX: Create a ref for the callback to break the dependency cycle between useLiveSession and the callbacks that use its state setters.
  const onUserTurnCompleteRef = useRef<(text: string) => void>(() => {});

  // FIX: Call useLiveSession before the callbacks that depend on it.
  // The onUserTurnComplete callback now safely calls the function stored in the ref.
  const { 
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
  } = useLiveSession({ 
    systemInstruction: dynamicSystemInstruction, 
    onUserTurnComplete: (text) => onUserTurnCompleteRef.current(text) 
  });

  // FIX: Define callbacks after useLiveSession so `setTranscript` is in scope.
  const addSystemMessage = useCallback((text: string) => {
    setTranscript(prev => [
      ...prev,
      { id: Date.now() + '-system', speaker: 'system', text, timestamp: new Date() }
    ]);
  }, [setTranscript]); // FIX: Add setTranscript to dependency array

  const updateSystemInstruction = useCallback(async () => {
    if (learningInstructions.length === 0) {
      addSystemMessage("No new instructions were given. Exiting learning mode.");
      return;
    }
    
    setIsUpdatingInstruction(true);
    addSystemMessage("Memorizing new instructions...");

    const prompt = `You are a prompt engineer updating the system instructions for a Yoga AI assistant.
Here are the current instructions:
---
${systemInstruction}
---

Here are the user's new requirements for modification. Intelligently integrate them into the existing instructions.
---
- ${learningInstructions.join('\n- ')}
---

Generate a new, complete, and updated system instruction that incorporates the user's changes. Maintain the original structure and tone, but apply the requested modifications. The output should ONLY be the new system instruction, without any extra text or explanation.`;

    try {
      const apiKey = process.env.API_KEY || '';
      if (!apiKey) throw new Error("API key not available for learning process.");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const newInstruction = response.text;
      if (!newInstruction) {
        throw new Error("The AI failed to generate an updated instruction set.");
      }
      
      setSystemInstruction(newInstruction);
      localStorage.setItem('gans-ai-system-instruction', newInstruction);
      addSystemMessage("Learning complete! Changes will be active in your next session.");
    } catch (e: any) {
      console.error("Failed to update system instruction", e);
      addSystemMessage(`Error: Failed to update instructions. ${e.message}`);
    } finally {
      setIsUpdatingInstruction(false);
      setLearningInstructions([]);
    }
  }, [learningInstructions, systemInstruction, addSystemMessage, setSystemInstruction, setIsUpdatingInstruction, setLearningInstructions]); // FIX: Add all dependencies

  const handleUserTurnComplete = useCallback((text: string) => {
    const lowerText = text.toLowerCase().trim();

    if (isLearningMode) {
      const stopKeywords = ['stop learning', 'finish training', 'end learning'];
      const cancelKeywords = ['cancel changes', 'discard changes', 'never mind'];

      if (stopKeywords.some(keyword => lowerText.includes(keyword))) {
        setIsLearningMode(false);
        updateSystemInstruction();
      } else if (cancelKeywords.some(keyword => lowerText.includes(keyword))) {
        if (window.confirm("Are you sure you want to discard the new instructions? This action cannot be undone.")) {
          setIsLearningMode(false);
          setLearningInstructions([]);
          addSystemMessage("Learning mode cancelled. All changes have been discarded.");
        } else {
          addSystemMessage("Cancellation aborted. You are still in learning mode.");
        }
      } else {
        setLearningInstructions(prev => [...prev, text]);
        addSystemMessage(`Noted: "${text}"`);
      }
    } else {
      const startKeywords = ['start learning', 'let\'s train', 'start memorizing'];
      if (startKeywords.some(keyword => lowerText.includes(keyword))) {
        setIsLearningMode(true);
        setLearningInstructions([]);
        addSystemMessage("Entered learning mode. Say your instructions. Say 'stop learning' when finished.");
      }
    }
  }, [isLearningMode, updateSystemInstruction, addSystemMessage, setIsLearningMode, setLearningInstructions]); // FIX: Add all dependencies
  
  // FIX: Update the ref with the latest version of the callback whenever it changes.
  useEffect(() => {
    onUserTurnCompleteRef.current = handleUserTurnComplete;
  }, [handleUserTurnComplete]);

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;
  const isError = connectionState === ConnectionState.ERROR;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center font-sans">
      
      <div className="w-full max-w-md bg-white h-screen sm:h-[90vh] sm:mt-[5vh] sm:rounded-3xl sm:shadow-2xl sm:border sm:border-slate-200 overflow-hidden flex flex-col relative transition-all duration-300">
        
        {isUpdatingInstruction && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <Loader2 className="animate-spin text-teal-600" size={48} />
            <p className="mt-4 text-slate-600 font-medium">Gans is learning...</p>
          </div>
        )}
        
        <Header />

        {isLearningMode && (
          <div className="bg-indigo-50 text-indigo-600 px-4 py-2 text-xs flex items-center justify-center gap-2 border-b border-indigo-100">
            <BrainCircuit size={14} />
            <span>Learning Mode: Say "stop learning" to save or "cancel changes" to discard.</span>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 text-red-600 px-4 py-2 text-xs flex items-center justify-center gap-2 border-b border-red-100 animate-fade-in">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-50/30">
          
          <div className="px-6 pt-4 pb-2 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Session</span>
              <span className="text-sm font-semibold text-slate-700">Full Body Flow</span>
            </div>
            
            {isConnected || isConnecting ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full text-white shadow-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-mono font-medium tracking-wide w-10 text-center">
                  {formatTime(sessionTime)}
                </span>
                 <span className="text-xs font-mono font-medium text-slate-400">/ {formatTime(sessionDuration)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <label htmlFor="duration-input" className="text-xs text-slate-500">Duration:</label>
                <input
                    id="duration-input"
                    type="number"
                    value={sessionDuration / 60}
                    onChange={(e) => {
                        const mins = parseInt(e.target.value, 10);
                        if (!isNaN(mins) && mins > 0) {
                            setSessionDuration(mins * 60);
                        }
                    }}
                    className="w-12 text-sm text-center font-medium bg-slate-100 border border-slate-200 rounded-md p-1 focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    min="1"
                    max="120"
                />
                <span className="text-xs text-slate-500">min</span>
              </div>
            )}
          </div>

          <div className="px-6 flex-shrink-0">
             <AudioVisualizer 
                userVolume={volume.user} 
                modelVolume={volume.model} 
                isActive={isConnected} 
                isLearning={isLearningMode}
             />
          </div>

          <div className="flex-1 overflow-hidden flex flex-col mt-4 bg-white rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] border-t border-slate-100">
             <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-white/95 backdrop-blur sticky top-0 z-10">
               <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Transcript</h2>
               {isConnected && (
                 <div className="flex items-center gap-2">
                   <button
                     onClick={isTimerPaused ? resumeTimer : pauseTimer}
                     className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                     title={isTimerPaused ? 'Resume Timer' : 'Pause Timer'}
                   >
                     {isTimerPaused ? <Play size={16} /> : <PauseCircle size={16} />}
                   </button>
                   <button
                     onClick={resetTimer}
                     className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                     title="Reset Timer"
                   >
                     <RotateCw size={16} />
                   </button>
                 </div>
               )}
             </div>
             <Transcript items={transcript} />
          </div>

        </div>

        <div className="bg-white p-6 border-t border-slate-100 z-20 relative">
          <div className="flex items-center justify-center gap-6">
             {isConnected || isConnecting ? (
               <button
                 onClick={disconnect}
                 className="group relative flex items-center justify-center w-full py-4 rounded-xl text-white shadow-lg transition-all duration-200 bg-red-600 hover:bg-red-700 hover:shadow-red-600/30 transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:shadow-none disabled:transform-none disabled:cursor-not-allowed"
                 title="End Practice"
                 disabled={isUpdatingInstruction || isLearningMode}
               >
                 <div className="flex items-center gap-2">
                   <Power size={20} />
                   <span className="font-semibold text-lg">End Practice</span>
                 </div>
               </button>
             ) : (
               <button
                 onClick={connect}
                 className="group relative flex items-center justify-center w-full py-4 rounded-xl text-white shadow-lg transition-all duration-200 bg-teal-600 hover:bg-teal-700 hover:shadow-teal-600/30 transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:shadow-none disabled:transform-none"
                 disabled={isUpdatingInstruction}
               >
                 <div className="flex items-center gap-2">
                   <PlayCircle size={20} />
                   <span className="font-semibold text-lg">Start Practice</span>
                 </div>
               </button>
             )}
          </div>
        </div>

      </div>

      <div className="hidden sm:block fixed bottom-8 text-slate-400 text-sm font-light">
         Gans AI • Hatha Yoga • Hinglish Instruction
      </div>

    </div>
  );
}
