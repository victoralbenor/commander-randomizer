import { useState } from 'react';
import { Dices, ShieldAlert } from 'lucide-react';
import ManualTables from './ManualTables.jsx';
import RollCard from './RollCard.jsx';
import { MIN_TABLE_SIZE, getLayouts, buildPairHistory, optimizeTables, getMovedIds } from '../lib/pairing.js';

export default function TablesTab({ players, presentPlayers, historyRolls, saveRoll, manual }) {
  const [selectedLayoutKey, setSelectedLayoutKey] = useState('');

  const presentCount = presentPlayers.length;
  const layouts = getLayouts(presentCount);
  const activeLayout = layouts.find((c) => c.join(',') === selectedLayoutKey) || layouts[0];

  // Why Randomize is disabled (empty string = ready).
  const blockReason = presentCount < MIN_TABLE_SIZE
    ? `Need at least ${MIN_TABLE_SIZE} players. Currently have ${presentCount}.`
    : '';

  // Shuffles everyone present, avoiding pairings already in the shared history
  // (manual rounds included).
  const generateTables = () => {
    if (blockReason || !activeLayout) return;
    const { tables } = optimizeTables(presentPlayers, activeLayout, buildPairHistory(historyRolls));
    saveRoll(tables.map((p) => ({ manual: false, players: p })));
  };

  // Records hand-started tables as a played round so the next randomize avoids them.
  const saveManualRound = () => {
    if (manual.blockReason || manual.manualTables.length === 0) return;
    saveRoll(manual.manualTables.map((p) => ({ manual: true, players: p })));
    manual.clear();
  };

  return (
    <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <ManualTables
        presentPlayers={presentPlayers}
        manualTables={manual.manualTables.map((t) => t.map((p) => p.id))}
        onChange={manual.setManualIds}
        onSave={saveManualRound}
        saveBlockReason={manual.blockReason}
      />

      {layouts.length > 1 && (
        <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            Table Layout ({presentCount} Players)
          </span>
          <div className="flex flex-wrap gap-2">
            {layouts.map((config) => {
              const key = config.join(',');
              return (
                <button
                  key={key}
                  onClick={() => setSelectedLayoutKey(key)}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold border transition-colors ${
                    activeLayout && activeLayout.join(',') === key
                      ? 'bg-orange-600/20 border-orange-500 text-orange-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {config.join(' / ')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={generateTables}
        disabled={!!blockReason}
        className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-orange-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
      >
        <Dices size={24} />
        <span className="text-lg">Randomize Tables</span>
      </button>

      {blockReason && players.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800/50 text-red-300 rounded-xl text-sm">
          <ShieldAlert size={18} className="shrink-0" />
          <p>{blockReason}</p>
        </div>
      )}

      {historyRolls.length === 0 && !blockReason && (
        <div className="text-center p-8 mt-4">
          <Dices size={48} className="mx-auto text-slate-800 mb-4" />
          <p className="text-slate-500 text-sm">Hit the button above to assign players to tables.</p>
          <p className="text-slate-600 text-xs mt-2">Currently selecting {presentCount} players.</p>
        </div>
      )}

      {historyRolls.length > 0 && (
        <div className="mt-2 flex flex-col gap-6">
          <div className="px-1">
            <span className="text-xs text-slate-500">
              History: {historyRolls.length} roll{historyRolls.length > 1 ? 's' : ''}
            </span>
          </div>
          {historyRolls.map((roll, i) => (
            <RollCard
              key={roll.id}
              roll={roll}
              isLatest={i === 0}
              movedIds={i === 0 ? getMovedIds(roll, historyRolls[1]) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
