import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, ROLLS_COLLECTION } from '../firebase.js';

// Shared roll history. Append-only: rolls are never edited or deleted,
// so the history stays consistent for fairness.
export default function useRolls(user, onError) {
  const [rolls, setRolls] = useState([]);

  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(
      collection(db, ROLLS_COLLECTION),
      (snapshot) => setRolls(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => onError('Unable to read roll history. Verify Firestore rules for the rolls collection.', err)
    );
  }, [user, onError]);

  // Newest first.
  const historyRolls = useMemo(() => [...rolls].sort((a, b) => b.createdAt - a.createdAt), [rolls]);

  // rawTables: [{ manual, players: [{ id, name, ... }] }]
  const saveRoll = (rawTables) => {
    if (!user) return;
    const tables = rawTables.map((t) => ({
      manual: t.manual,
      players: t.players.map(({ id, name }) => ({ id, name })),
    }));
    setDoc(doc(db, ROLLS_COLLECTION, crypto.randomUUID()), { createdAt: Date.now(), tables })
      .catch((err) => onError('Unable to save the roll. Verify Firestore write permissions for the rolls collection.', err));
  };

  return { historyRolls, saveRoll };
}
