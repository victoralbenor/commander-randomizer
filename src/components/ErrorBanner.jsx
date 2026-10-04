import { ShieldAlert, X } from 'lucide-react';

export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="mx-4 mt-3 flex items-start gap-2 p-3 bg-amber-900/30 border border-amber-800/50 text-amber-200 rounded-xl text-sm">
      <ShieldAlert size={18} className="shrink-0 mt-0.5" />
      <p className="flex-1">{message}</p>
      <button onClick={onDismiss} aria-label="Dismiss" className="p-0.5 text-amber-300/70 hover:text-amber-200">
        <X size={16} />
      </button>
    </div>
  );
}
