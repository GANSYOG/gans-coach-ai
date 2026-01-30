import React, { memo } from 'react';
import { BrainCircuit } from 'lucide-react';

interface AudioVisualizerProps {
  userVolume: number;
  modelVolume: number;
  isActive: boolean;
  isLearning: boolean;
}

// ⚡ Bolt: Wrapped in React.memo to prevent unnecessary re-renders when parent state (timer) changes but volume hasn't.
export const AudioVisualizer: React.FC<AudioVisualizerProps> = memo(({ userVolume, modelVolume, isActive, isLearning }) => {
  const userScale = 1 + Math.min(userVolume * 2, 0.5); 
  const modelScale = 1 + Math.min(modelVolume * 3, 1.5); 
  
  const baseSize = 180;

  return (
    <div className={`relative w-full h-80 flex items-center justify-center bg-slate-50/50 rounded-3xl border border-slate-100 overflow-hidden mt-6 transition-colors duration-500 ${isLearning ? 'bg-indigo-50/50' : ''}`}>
      {/* Background static circles */}
      <div className={`absolute w-64 h-64 rounded-full opacity-50 transition-colors duration-500 ${isLearning ? 'border border-indigo-100' : 'border border-teal-100'}`}></div>
      <div className={`absolute w-48 h-48 rounded-full opacity-50 transition-colors duration-500 ${isLearning ? 'border border-indigo-200' : 'border border-teal-200'}`}></div>

      {/* Model Aura (Pulsing Outer Ring) */}
      <div 
        className={`absolute rounded-full mix-blend-multiply filter blur-2xl transition-all duration-75 ease-out ${isActive ? 'opacity-70' : 'opacity-0'} ${isLearning ? 'bg-indigo-100' : 'bg-teal-100'}`}
        style={{ 
          width: `${baseSize}px`, 
          height: `${baseSize}px`,
          transform: `scale(${isActive ? modelScale : 0.8})`
        }}
      />

      {/* User Aura (Inner Core) */}
      <div 
        className={`absolute rounded-full mix-blend-multiply filter blur-xl transition-all duration-75 ease-out ${isActive ? 'opacity-80' : 'opacity-0'} ${isLearning ? 'bg-purple-200' : 'bg-sky-200'}`}
        style={{ 
          width: `${baseSize * 0.6}px`, 
          height: `${baseSize * 0.6}px`,
          transform: `scale(${isActive ? userScale : 0.8})`
        }}
      />

      {/* Center Graphic */}
      <div className="relative z-10 flex flex-col items-center justify-center">
         <div className={`w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center transition-all duration-500 ${isActive ? (isLearning ? 'border-4 border-indigo-500' : 'border-4 border-teal-500') : 'border-4 border-slate-200'}`}>
            {isLearning ? (
              <BrainCircuit className="text-indigo-500" size={32} />
            ) : (
              <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${isActive ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`}></div>
            )}
         </div>
         <div className="mt-4 text-center">
            <span className={`text-sm font-medium transition-colors duration-300 ${isActive ? (isLearning ? 'text-indigo-700' : 'text-teal-700') : 'text-slate-400'}`}>
               {isLearning ? "Learning..." : (isActive ? (modelVolume > 0.1 ? "Gans is speaking..." : "Listening...") : "Ready to start")}
            </span>
         </div>
      </div>
    </div>
  );
});

AudioVisualizer.displayName = 'AudioVisualizer';
