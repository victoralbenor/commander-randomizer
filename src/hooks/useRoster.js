import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, PLAYERS_COLLECTION } from '../firebase.js';

// Shared roster + attendance, live from Firestore. Anyone can add/remove/toggle.
// Writes are not awaited: Firestore's local cache updates the UI immediately
// (and an await would hang while offline). Failures go to `onError`.
export default function useRoster(user, onError) {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(
      collection(db, PLAYERS_COLLECTION),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setPlayers(list);
      },
      (err) => onError('Unable to read the roster. Verify Firestore rules for the players collection.', err)
    );
  }, [user, onError]);

  const presentPlayers = useMemo(() => players.filter((p) => p.isPresent), [players]);

  const addPlayer = (name) => {
    if (!user || !name) return;
    setDoc(doc(db, PLAYERS_COLLECTION, crypto.randomUUID()), { name, isPresent: true })
      .catch((err) => onError('Unable to add player. Verify Firestore write permissions.', err));
  };

  const removePlayer = (id) => {
    if (!user) return;
    deleteDoc(doc(db, PLAYERS_COLLECTION, id))
      .catch((err) => onError('Unable to remove player. Verify Firestore delete permissions.', err));
  };

  const togglePresence = (id, currentStatus) => {
    if (!user) return;
    setDoc(doc(db, PLAYERS_COLLECTION, id), { isPresent: !currentStatus }, { merge: true })
      .catch((err) => onError('Unable to update presence. Verify Firestore update permissions.', err));
  };

  const setAllPresence = (status) => {
    if (!user || players.length === 0) return;
    const batch = writeBatch(db);
    players.forEach((p) => {
      if (p.isPresent !== status) batch.set(doc(db, PLAYERS_COLLECTION, p.id), { isPresent: status }, { merge: true });
    });
    batch.commit().catch((err) => onError('Unable to update presence. Verify Firestore update permissions.', err));
  };

  return { players, presentPlayers, addPlayer, removePlayer, togglePresence, setAllPresence };
}
