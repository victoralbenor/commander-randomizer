import { Clock, ArrowRightLeft, Lock } from 'lucide-react';

const pad = (n) => n.toString().padStart(2, '0');
const formatTimestamp = (d) =>
  `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// One saved roll. `movedIds` (latest roll only) highlights players whose table changed.
export default function RollCard({ roll, isLatest, movedIds }) {
  return (
    <div className={`relative flex flex-col gap-3 ${!isLatest ? 'opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all duration-300' : ''}`}>
      <div className="flex items-center justify-between px-1 border-b border-slate-800 pb-2">
        <h2 className={`text-sm font-bold uppercase tracking-wider ${isLatest ? 'text-orange-400' : 'text-slate-500'}`}>
          {isLatest ? 'Current Roll' : 'Previous Roll'}
          {roll.tables.every((t) => t.manual) && ' · Manual'}
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded-md border border-slate-800">
          <Clock size={12} />
          {formatTimestamp(new Date(roll.createdAt))}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {roll.tables.map((table, index) => (
          <div key={index} className="bg-slate-800/60 rounded-2xl border border-slate-700 overflow-hidden shadow-lg flex flex-col h-full">
            <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex justify-between items-center shrink-0">
              <h3 className={`flex items-center gap-1.5 font-bold text-sm ${isLatest ? 'text-orange-300' : 'text-slate-300'}`}>
                Table {index + 1}
                {table.manual && <Lock size={11} className="text-slate-500" aria-label="Manual table" />}
              </h3>
              <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 font-medium">
                {table.players.length} P
              </span>
            </div>
            <div className="p-3 flex-1">
              <ul className="flex flex-col gap-2">
                {table.players.map((player, pIndex) => {
                  const moved = !!movedIds && movedIds.has(player.id);
                  return (
                    <li key={player.id} className="flex items-center gap-2 text-slate-200">
                      <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                        {pIndex + 1}
                      </span>
                      <span className={`font-medium text-sm truncate ${moved ? 'text-orange-300' : ''}`}>{player.name}</span>
                      {moved && <ArrowRightLeft size={12} className="text-orange-500 shrink-0 ml-auto" />}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
