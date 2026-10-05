import { useState } from 'react';
import { Plus, X, Link2, Pencil } from 'lucide-react';
import { MAX_TABLE_SIZE } from '../lib/pairing.js';

/**
 * Groups of players who want to share a table in the NEXT roll only
 * (e.g. a newcomer and the friends they brought). Cleared after randomizing.
 *
 * `presentPlayers`: [{ id, name }]   `groups`: [[id, ...], ...]
 */
export default function TogetherGroups({ presentPlayers, groups, onChange }) {
  const [editing, setEditing] = useState(null);

  const nameById = new Map(presentPlayers.map((p) => [p.id, p.name]));
  const taken = new Set(groups.flat());
  const available = presentPlayers.filter((p) => !taken.has(p.id));
  const activeEditing = editing !== null && editing < groups.length ? editing : null;

  const addGroup = () => {
    onChange([...groups, []]);
    setEditing(groups.length);
  };

  const removeGroup = (index) => {
    onChange(groups.filter((_, i) => i !== index));
    setEditing(null);
  };

  const addPlayer = (index, id) => {
    onChange(groups.map((g, i) => (i === index && g.length < MAX_TABLE_SIZE ? [...g, id] : g)));
  };

  const removePlayer = (index, id) => {
    onChange(groups.map((g, i) => (i === index ? g.filter((x) => x !== id) : g)));
  };

  return (
    <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800 flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Sit together {groups.length > 0 && `(${groups.length})`}
        </span>
        <button
          onClick={addGroup}
          disabled={available.length < 2}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors active:scale-95"
        >
          <Plus size={14} className="text-orange-400" /> Add group
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-slate-500 text-xs px-1">
          Want some players on the same table? Group them here. It only applies to the next randomize.
        </p>
      ) : (
        <p className="text-slate-500 text-xs px-1">Applies to the next randomize only.</p>
      )}

      {groups.map((group, index) => {
        const isEditing = activeEditing === index;
        const tooSmall = group.length < 2;
        return (
          <div
            key={index}
            className={`rounded-xl border p-3 flex flex-col gap-2 ${
              isEditing ? 'border-orange-500/60 bg-orange-600/5' : 'border-slate-700 bg-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 font-bold text-sm text-orange-300">
                <Link2 size={13} /> Group {index + 1}
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tooSmall ? 'bg-amber-900/40 text-amber-300' : 'bg-slate-900 text-slate-400'}`}>
                  {group.length}/{MAX_TABLE_SIZE}
                </span>
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(isEditing ? null : index)}
                  aria-label={isEditing ? 'Done editing' : 'Edit group'}
                  className="p-1.5 text-slate-400 hover:text-orange-300 transition-colors"
                >
                  {isEditing ? <span className="text-xs font-bold">Done</span> : <Pencil size={15} />}
                </button>
                <button
                  onClick={() => removeGroup(index)}
                  aria-label="Remove group"
                  className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {group.length === 0 ? (
              <p className="text-slate-500 text-xs">No players yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {group.map((id) => (
                  <button
                    key={id}
                    onClick={() => removePlayer(index, id)}
                    className="flex items-center gap-1 bg-orange-600/20 border border-orange-500/40 text-orange-100 text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-lg active:scale-95"
                  >
                    {nameById.get(id)} <X size={12} className="text-orange-400" />
                  </button>
                ))}
              </div>
            )}

            {tooSmall && <p className="text-amber-300/80 text-xs">Needs at least 2 players, otherwise it is ignored.</p>}

            {isEditing && (
              <div className="pt-2 border-t border-slate-700/60">
                {available.length === 0 ? (
                  <p className="text-slate-500 text-xs">Everyone present is already in a group.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {available.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => addPlayer(index, player.id)}
                        disabled={group.length >= MAX_TABLE_SIZE}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700/50 text-slate-300 text-xs font-semibold py-2 px-1 rounded-lg truncate active:scale-95"
                      >
                        {player.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
