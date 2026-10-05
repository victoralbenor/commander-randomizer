import { useMemo, useState } from 'react';

// "Sit together" groups for the next roll only. Stored as id lists and resolved
// against who is present, so absent players drop out and nobody is in two groups.
export default function useTogetherGroups(presentPlayers) {
  const [groupIds, setGroupIds] = useState([]);

  const groups = useMemo(() => {
    const byId = new Map(presentPlayers.map((p) => [p.id, p]));
    const taken = new Set();
    return groupIds.map((ids) =>
      ids
        .filter((id) => byId.has(id) && !taken.has(id))
        .map((id) => {
          taken.add(id);
          return byId.get(id);
        })
    );
  }, [presentPlayers, groupIds]);

  return { groups, setGroupIds, clear: () => setGroupIds([]) };
}
