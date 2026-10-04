import { Check, X } from 'lucide-react';

const BULK_BUTTON =
  'flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700/50 transition-colors active:scale-95';

export default function PresentTab({ players, presentCount, onToggle, onSetAll }) {
  return (
    <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Who is playing?</h2>
        <span className="bg-orange-500/20 text-orange-400 text-xs font-bold px-3 py-1 rounded-full">
          {presentCount} Present
        </span>
      </div>

      {players.length > 0 && (
        <div className="flex gap-2 mb-1">
          <button onClick={() => onSetAll(true)} className={BULK_BUTTON}>
            <Check size={16} className="text-orange-400" /> Select All
          </button>
          <button onClick={() => onSetAll(false)} className={BULK_BUTTON}>
            <X size={16} className="text-slate-500" /> Select None
          </button>
        </div>
      )}

      {players.length === 0 ? (
        <div className="text-center p-8 bg-slate-900/50 rounded-2xl border border-slate-800/50 border-dashed">
          <p className="text-slate-500 text-sm">Go to the Roster tab to add players first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() => onToggle(player.id, player.isPresent)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all active:scale-[0.98] min-h-[64px] ${
                player.isPresent
                  ? 'bg-orange-600/20 border-orange-500/50 text-orange-100'
                  : 'bg-slate-800/60 border-slate-700/50 text-slate-500 opacity-80'
              }`}
            >
              <span className="font-semibold text-sm text-center w-full break-words line-clamp-2 leading-tight">
                {player.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
