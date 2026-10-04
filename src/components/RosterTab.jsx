import { useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';

export default function RosterTab({ players, onAdd, onRemove }) {
  const [name, setName] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setName('');
    onAdd(trimmed);
  };

  return (
    <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <form onSubmit={submit} className="flex gap-2 relative">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add new player..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-orange-600 text-white p-3 rounded-xl transition-colors shadow-lg shadow-orange-900/20"
        >
          <UserPlus size={20} />
        </button>
      </form>

      <div className="mt-2">
        <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">
          Saved Roster ({players.length})
        </h2>
        {players.length === 0 ? (
          <div className="text-center p-8 bg-slate-900/50 rounded-2xl border border-slate-800/50 border-dashed">
            <p className="text-slate-500 text-sm">Your roster is empty. Add players above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {players.map((player) => (
              <div key={player.id} className="flex items-center justify-between bg-slate-800/80 pl-3 pr-1 py-1.5 rounded-xl border border-slate-700/50">
                <span className="font-medium text-sm truncate pr-2">{player.name}</span>
                <button
                  onClick={() => onRemove(player.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
