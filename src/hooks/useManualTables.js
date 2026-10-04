import { useMemo, useState } from 'react';
import { MIN_TABLE_SIZE } from '../lib/pairing.js';

// Tables the group already started by hand. Kept as id lists and resolved against
// who is present, so absent players drop out and nobody holds two seats.
export default function useManualTables(presentPlayers) {
  const [manualIds, setManualIds] = useState([]);

  const manualTables = useMemo(() => {
    const byId = new Map(presentPlayers.map((p) => [p.id, p]));
    const taken = new Set();
    return manualIds.map((ids) =>
      ids
        .filter((id) => byId.has(id) && !taken.has(id))
        .map((id) => {
          taken.add(id);
          return byId.get(id);
        })
    );
  }, [presentPlayers, manualIds]);

  // Why saving is disabled (empty string = ready).
  const short = manualTables.findIndex((t) => t.length < MIN_TABLE_SIZE);
  const blockReason = short === -1 ? '' : `Manual table ${short + 1} needs at least ${MIN_TABLE_SIZE} players.`;

  return { manualTables, setManualIds, clear: () => setManualIds([]), blockReason };
}
