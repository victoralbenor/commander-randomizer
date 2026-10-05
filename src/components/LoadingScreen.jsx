import { Loader2 } from 'lucide-react';

export default function LoadingScreen({ label = 'Loading roster…' }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
      <Loader2 size={32} className="animate-spin text-orange-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
