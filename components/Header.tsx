import React, { memo } from 'react';
import { Mic } from 'lucide-react';

// ⚡ Bolt: Wrapped in React.memo to prevent unnecessary re-renders when parent state (volume/timer) changes.
// This component is static and should not re-render on every frame.
export const Header: React.FC = memo(() => {
  return (
    <div className="w-full bg-white border-b border-slate-200 p-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white">
          <Mic size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Gans AI</h1>
          <p className="text-sm text-slate-500">Professional Hatha Yoga Coach</p>
        </div>
      </div>
      <div className="hidden sm:block text-xs text-slate-400 font-medium px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
        Powered by Gemini 2.5 Live
      </div>
    </div>
  );
});

Header.displayName = 'Header';
