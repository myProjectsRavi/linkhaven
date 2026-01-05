import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface LockScreenProps {
  onUnlock: (pin: string) => boolean;
  onSetup: (pin: string) => void;
  isSetupMode: boolean;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, onSetup, isSetupMode }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (shake) {
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [shake]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      setShake(true);
      return;
    }

    if (isSetupMode) {
      if (confirmPin && pin !== confirmPin) {
        setError('PINs do not match');
        setShake(true);
        return;
      }
      if (!confirmPin) {
        // Move to confirmation step visually or handle here (simplified for single screen)
        // For this UI, we will just expect them to type it in a second field that appears
        return; 
      }
      onSetup(pin);
    } else {
      const success = onUnlock(pin);
      if (!success) {
        setError('Incorrect PIN');
        setShake(true);
        setPin('');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-indigo-500/5 blur-[120px]"></div>
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[100px]"></div>
      </div>

      <div className={`relative bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col items-center text-center transition-transform ${shake ? 'translate-x-[-5px]' : ''} ${shake ? 'animate-pulse' : ''}`}>
        
        <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/10">
          {isSetupMode ? <ShieldCheck size={32} className="text-emerald-400" /> : <Lock size={32} className="text-indigo-400" />}
        </div>

        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
          {isSetupMode ? 'Secure Your Haven' : 'Welcome Back'}
        </h1>
        <p className="text-slate-400 text-sm mb-8">
          {isSetupMode 
            ? 'Set a PIN to keep your bookmarks private.' 
            : 'Enter your PIN to access your workspace.'}
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={isSetupMode ? "Create PIN" : "Enter PIN"}
              className="w-full bg-slate-900/50 border border-slate-600 focus:border-indigo-500 rounded-xl px-4 py-3 text-center text-white text-lg tracking-[0.5em] placeholder:tracking-normal placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              autoFocus
            />
            
            {isSetupMode && (
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm PIN"
                className="w-full bg-slate-900/50 border border-slate-600 focus:border-indigo-500 rounded-xl px-4 py-3 text-center text-white text-lg tracking-[0.5em] placeholder:tracking-normal placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            )}
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-red-400 text-xs font-medium bg-red-500/10 py-2 rounded-lg">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 mt-4 active:scale-95"
          >
            <span>{isSetupMode ? 'Set PIN' : 'Unlock'}</span>
            <ArrowRight size={18} />
          </button>
        </form>
        
        {!isSetupMode && (
            <p className="mt-6 text-xs text-slate-600">
                Data stored locally on this device.
            </p>
        )}
      </div>
    </div>
  );
};