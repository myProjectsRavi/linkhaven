import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[60] transition-all duration-500 transform translate-y-0 opacity-100">
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${
        type === 'success' 
          ? 'bg-emerald-50/95 border-emerald-100 text-emerald-800' 
          : 'bg-red-50/95 border-red-100 text-red-800'
      }`}>
        <div className={`p-1 rounded-full ${type === 'success' ? 'bg-emerald-200' : 'bg-red-200'}`}>
            {type === 'success' ? <CheckCircle size={16} className="text-emerald-700" /> : <AlertCircle size={16} className="text-red-700" />}
        </div>
        <span className="text-sm font-semibold tracking-wide">{message}</span>
        <button 
            onClick={onClose} 
            className="ml-4 p-1 hover:bg-black/5 rounded-full transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};