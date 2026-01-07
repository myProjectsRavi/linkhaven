import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, ShieldCheck, AlertCircle, Eye, EyeOff, ChevronDown, ChevronRight, Ghost } from 'lucide-react';

interface LockScreenProps {
  onUnlock: (pin: string) => Promise<boolean> | boolean;
  onSetup: (pin: string, vaultPin?: string) => void;
  isSetupMode: boolean;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, onSetup, isSetupMode }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [vaultPin, setVaultPin] = useState('');
  const [confirmVaultPin, setConfirmVaultPin] = useState('');
  const [showVaultSetup, setShowVaultSetup] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (shake) {
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [shake]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      setShake(true);
      return;
    }

    if (isSetupMode) {
      if (pin !== confirmPin) {
        setError('PINs do not match');
        setShake(true);
        return;
      }
      if (showVaultSetup && vaultPin) {
        if (vaultPin.length < 4) {
          setError('Vault PIN must be at least 4 digits');
          setShake(true);
          return;
        }
        if (vaultPin !== confirmVaultPin) {
          setError('Vault PINs do not match');
          setShake(true);
          return;
        }
        if (vaultPin === pin) {
          setError('Vault PIN must be different from main PIN');
          setShake(true);
          return;
        }
      }
      onSetup(pin, showVaultSetup && vaultPin ? vaultPin : undefined);
    } else {
      setIsLoading(true);
      const success = await onUnlock(pin);
      setIsLoading(false);
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

      <div className={`relative bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col items-center text-center transition-transform ${shake ? 'animate-shake' : ''}`}>

        <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/10">
          {isSetupMode ? <ShieldCheck size={32} className="text-emerald-400" /> : <Lock size={32} className="text-indigo-400" />}
        </div>

        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
          {isSetupMode ? 'Secure Your Haven' : 'Welcome Back'}
        </h1>
        <p className="text-slate-400 text-sm mb-8">
          {isSetupMode
            ? 'Set a PIN to encrypt and protect your bookmarks.'
            : 'Enter your PIN to decrypt your workspace.'}
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-4">
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder={isSetupMode ? "Create PIN (min 4 digits)" : "Enter PIN"}
                className="w-full bg-slate-900/50 border border-slate-600 focus:border-indigo-500 rounded-xl px-4 py-3 text-center text-white text-lg tracking-[0.3em] placeholder:tracking-normal placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all pr-12"
                autoFocus
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {isSetupMode && (
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Confirm PIN"
                  className="w-full bg-slate-900/50 border border-slate-600 focus:border-indigo-500 rounded-xl px-4 py-3 text-center text-white text-lg tracking-[0.3em] placeholder:tracking-normal placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all pr-12"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}

            {/* Ghost Vault Setup (optional) */}
            {isSetupMode && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowVaultSetup(!showVaultSetup)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-400 hover:text-slate-300 bg-slate-800/50 rounded-lg border border-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Ghost size={14} />
                    <span>Setup Ghost Vault (Optional)</span>
                  </div>
                  {showVaultSetup ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {showVaultSetup && (
                  <div className="mt-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg space-y-3">
                    <p className="text-[10px] text-purple-300">
                      🔒 <strong>Ghost Vault</strong>: Hidden vault accessible with a separate PIN. Use for sensitive bookmarks.
                    </p>
                    <div className="relative">
                      <input
                        type={showPin ? "text" : "password"}
                        value={vaultPin}
                        onChange={(e) => setVaultPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="Vault PIN (different from main)"
                        className="w-full bg-slate-900/50 border border-purple-500/30 focus:border-purple-500 rounded-xl px-4 py-2.5 text-center text-white text-lg tracking-[0.3em] placeholder:tracking-normal placeholder:text-slate-600 placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type={showPin ? "text" : "password"}
                        value={confirmVaultPin}
                        onChange={(e) => setConfirmVaultPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="Confirm Vault PIN"
                        className="w-full bg-slate-900/50 border border-purple-500/30 focus:border-purple-500 rounded-xl px-4 py-2.5 text-center text-white text-lg tracking-[0.3em] placeholder:tracking-normal placeholder:text-slate-600 placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                )}
              </div>
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
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 mt-4 active:scale-95"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Decrypting...</span>
              </>
            ) : (
              <>
                <span>{isSetupMode ? 'Set PIN & Encrypt' : 'Unlock'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 space-y-2">
          {!isSetupMode && (
            <p className="text-xs text-slate-600">
              Data is encrypted and stored locally.
            </p>
          )}
          {isSetupMode && (
            <p className="text-xs text-slate-500">
              🔒 Your data will be encrypted with AES-256
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};