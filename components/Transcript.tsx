
import React, { useEffect, useRef } from 'react';
import { TranscriptItem } from '../types.ts';
import { User, Sparkles, Info, Wind } from 'lucide-react';

interface TranscriptProps {
  items: TranscriptItem[];
}

export const Transcript: React.FC<TranscriptProps> = ({ items }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-8">
        <div className="w-20 h-20 bg-teal-50 border border-teal-100 rounded-full flex items-center justify-center mb-6">
          <Wind size={36} className="text-teal-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Welcome to Gans AI</h2>
        <p className="max-w-xs text-sm leading-relaxed mb-6">
          Your personal Hatha Yoga coach, designed to help desk workers stretch, strengthen, and de-stress.
        </p>
        <div className="text-xs text-slate-400 space-y-1">
            <p>• Counteract prolonged sitting</p>
            <p>• Boost energy & focus</p>
            <p>• Guided by an expert AI</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
      {items.map((item) => {
        if (item.speaker === 'system') {
          return (
            <div key={item.id} className="flex items-center justify-center gap-2 text-xs text-slate-400 italic">
              <Info size={14} />
              <span>{item.text}</span>
            </div>
          );
        }

        return (
          <div 
            key={item.id} 
            className={`flex gap-4 ${item.speaker === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white shadow-sm
              ${item.speaker === 'user' ? 'bg-sky-500' : 'bg-teal-600'}`}>
              {item.speaker === 'user' ? <User size={14} /> : <Sparkles size={14} />}
            </div>
            
            <div className={`flex flex-col max-w-[80%] ${item.speaker === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                ${item.speaker === 'user' 
                  ? 'bg-sky-50 text-sky-900 rounded-tr-none' 
                  : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}
              >
                {item.text}
              </div>
              <span className="text-[10px] text-slate-300 mt-1 px-1">
                {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
