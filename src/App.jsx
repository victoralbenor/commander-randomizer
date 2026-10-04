import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Users, CheckSquare, Dices, UserPlus, Trash2, ShieldAlert, Clock, ArrowRightLeft, Check, X, Undo2, RotateCcw, Lock } from 'lucide-react';
import {
  initializeApp
} from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import ManualTables from './components/ManualTables.jsx';
import { MIN_TABLE_SIZE, getLayouts, buildPairHistory, optimizeTables } from './lib/pairing.js';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app, auth, db, appId;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = import.meta.env.VITE_FIREBASE_APP_ID || 'commander-randomizer-app';
} catch (e) {
  console.error("Firebase initialization failed", e);
}

const DEFAULT_ROSTER = ["Betão", "Eddie", "Emanas", "Zoio", "Timas", "Igão", "Bisão", "Limosito", "Miranda", "Lucin", "Matias", "Zamis", "André", "Paulo", "Vitam", "Pulga", "Marcelo"];

const PLAYERS_COLLECTION_PATH = 'players';
const ROLLS_COLLECTION_PATH = 'rolls';

const formatTimestamp = (date) => {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// Table index per player in the previous roll, but only when that roll had the
// same players and layout (otherwise "moved" highlighting is meaningless).
const getPrevTableMap = (roll, prevRoll) => {
  if (!prevRoll || prevRoll.playerIds !== roll.playerIds || prevRoll.layout !== roll.layout) return null;
  const map = {};
  prevRoll.tables.forEach((table, index) => {
    table.players.forEach(player => {
      map[player.id] = index;
    });
  });
  return map;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [activeTab, setActiveTab] = useState('attendance');
  const [selectedLayoutKey, setSelectedLayoutKey] = useState('');
  const [dbError, setDbError] = useState('');
  const [rolls, setRolls] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [manualIds, setManualIds] = useState([]);
  const hasInjectedDefault = useRef(false);

  const presentPlayers = useMemo(() => players.filter(p => p.isPresent), [players]);
  const presentCount = presentPlayers.length;

  // Tables the group already started by hand (present players only, one seat per player).
  const manualTables = useMemo(() => {
    const byId = new Map(presentPlayers.map(p => [p.id, p]));
    const taken = new Set();
    return manualIds.map(ids => ids
      .filter(id => byId.has(id) && !taken.has(id))
      .map(id => {
        taken.add(id);
        return byId.get(id);
      }));
  }, [presentPlayers, manualIds]);

  // Rolls of the current session, newest first.
  const sessionRolls = useMemo(
    () => rolls
      .filter(r => r.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt),
    [rolls, sessionId]
  );

  const currentConfigs = getLayouts(presentCount);
  const activeLayout = currentConfigs.find(c => c.join(',') === selectedLayoutKey) || currentConfigs[0];

  // Why Randomize is disabled (empty string = ready).
  const blockReason = presentCount < MIN_TABLE_SIZE
    ? `Need at least ${MIN_TABLE_SIZE} players. Currently have ${presentCount}.`
    : '';

  // Why saving the manual round is disabled (empty string = ready).
  const manualBlockReason = (() => {
    const short = manualTables.findIndex(t => t.length < MIN_TABLE_SIZE);
    return short === -1 ? '' : `Manual table ${short + 1} needs at least ${MIN_TABLE_SIZE} players.`;
  })();

  // --- Auth & Data Fetching ---
  useEffect(() => {
    if (!auth) return;

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error('Authentication Error:', err);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    // GLOBAL PERSISTENCE
    const playersRef = collection(db, PLAYERS_COLLECTION_PATH);

    // Check and inject default roster if empty
    const checkDefault = async () => {
      if (hasInjectedDefault.current) return;
      try {
        const snap = await getDocs(playersRef);
        if (snap.empty) {
          hasInjectedDefault.current = true;
          DEFAULT_ROSTER.forEach(name => {
            const newRef = doc(playersRef);
            setDoc(newRef, { name, isPresent: true });
          });
        }
      } catch (e) {
        console.error('Firestore read failed:', e);
        setDbError('Firestore access failed. Please verify Firestore rules and collection permissions.');
      }
    };
    checkDefault();

    const unsubscribe = onSnapshot(playersRef, (snapshot) => {
      const fetchedPlayers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedPlayers.sort((a, b) => a.name.localeCompare(b.name));
      setPlayers(fetchedPlayers);
    }, (error) => {
      console.error("Error fetching players:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Current session marker, shared across devices (meta/session). "default" until someone starts a new one.
  useEffect(() => {
    if (!user || !db) return;
    const unsubscribe = onSnapshot(doc(db, 'meta', 'session'), (snap) => {
      setSessionId(snap.exists() ? snap.data().id : 'default');
    }, (error) => {
      console.error('Error reading session:', error);
      setDbError('Unable to read the session. Verify Firestore rules for the meta collection.');
      setSessionId('default');
    });
    return () => unsubscribe();
  }, [user]);

  // Roll history for the current session, shared across devices.
  useEffect(() => {
    if (!user || !db || !sessionId) return;
    const rollsQuery = query(collection(db, ROLLS_COLLECTION_PATH), where('sessionId', '==', sessionId));
    const unsubscribe = onSnapshot(rollsQuery, (snapshot) => {
      setRolls(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error fetching rolls:', error);
      setDbError('Unable to read roll history. Verify Firestore rules for the rolls collection.');
    });
    return () => unsubscribe();
  }, [user, sessionId]);

  // --- Handlers ---
  const addPlayer = async (e) => {
    e.preventDefault();
    const nameToAdd = newPlayerName.trim();
    if (!nameToAdd || !user) return;

    // Instant clear
    setNewPlayerName('');

    const newId = crypto.randomUUID();
    const playerRef = doc(db, PLAYERS_COLLECTION_PATH, newId);

    try {
      await setDoc(playerRef, {
        name: nameToAdd,
        isPresent: true
      });
    } catch (err) {
      console.error("Error adding player:", err);
      setDbError('Unable to add player. Verify Firestore write permissions.');
    }
  };

  const removePlayer = async (id) => {
    if (!user) return;
    try {
      const playerRef = doc(db, PLAYERS_COLLECTION_PATH, id);
      await deleteDoc(playerRef);
    } catch (err) {
      console.error("Error removing player:", err);
      setDbError('Unable to remove player. Verify Firestore delete permissions.');
    }
  };

  const togglePresence = async (id, currentStatus) => {
    if (!user) return;
    try {
      const playerRef = doc(db, PLAYERS_COLLECTION_PATH, id);
      await setDoc(playerRef, { isPresent: !currentStatus }, { merge: true });
    } catch (err) {
      console.error("Error toggling presence:", err);
      setDbError('Unable to update presence. Verify Firestore update permissions.');
    }
  };

  const setAllPresence = async (status) => {
    if (!user || players.length === 0) return;
    try {
      const promises = players.map(player => {
        if (player.isPresent !== status) {
          const playerRef = doc(db, PLAYERS_COLLECTION_PATH, player.id);
          return setDoc(playerRef, { isPresent: status }, { merge: true });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
    } catch (err) {
      console.error("Error setting bulk presence:", err);
    }
  };

  // --- Generation ---
  // Saves one roll (a list of { manual, players } tables) to the shared session history.
  const saveRoll = (rawTables) => {
    const tables = rawTables.map(t => ({
      manual: t.manual,
      players: t.players.map(({ id, name }) => ({ id, name })),
    }));

    const roll = {
      sessionId,
      createdAt: Date.now(),
      tables,
      playerIds: tables.flatMap(t => t.players.map(p => p.id)).sort().join(','),
      layout: tables.map(t => (t.manual ? `m${t.players.length}` : t.players.length)).join(','),
    };

    // Not awaited: Firestore's local cache updates the UI immediately, and an
    // await would hang while offline.
    setDoc(doc(db, ROLLS_COLLECTION_PATH, crypto.randomUUID()), roll).catch((err) => {
      console.error('Error saving roll:', err);
      setDbError('Unable to save the roll. Verify Firestore write permissions for the rolls collection.');
    });
  };

  // Shuffles everyone present, avoiding pairings already seen this session
  // (including manual rounds).
  const generateTables = () => {
    if (blockReason || !sessionId || !user || !activeLayout) return;
    const history = buildPairHistory(sessionRolls);
    const { tables } = optimizeTables(presentPlayers, activeLayout, history);
    saveRoll(tables.map(players => ({ manual: false, players })));
  };

  // Records tables the group started by hand as a played round, so the next
  // randomize treats those pairings as already played.
  const saveManualRound = () => {
    if (manualBlockReason || manualTables.length === 0 || !sessionId || !user) return;
    saveRoll(manualTables.map(players => ({ manual: true, players })));
    setManualIds([]);
  };

  const undoLastRoll = () => {
    const latest = sessionRolls[0];
    if (!latest || !user) return;
    deleteDoc(doc(db, ROLLS_COLLECTION_PATH, latest.id)).catch((err) => {
      console.error('Error undoing roll:', err);
      setDbError('Unable to undo the last roll. Verify Firestore delete permissions for the rolls collection.');
    });
  };

  const startNewSession = () => {
    if (!user) return;
    if (!window.confirm('Start a new session? Previous rolls stop counting toward pairings.')) return;
    setDoc(doc(db, 'meta', 'session'), { id: crypto.randomUUID() }).catch((err) => {
      console.error('Error starting session:', err);
      setDbError('Unable to start a new session. Verify Firestore write permissions for the meta collection.');
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200 font-sans w-full relative overflow-hidden shadow-2xl shadow-black">

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 shrink-0 flex items-center justify-between z-10">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
            Commander Tables
          </h1>
          <p className="text-xs text-slate-500 mt-1">Randomize your MTG pods</p>
        </div>
      </div>

      {/* Firestore errors (rules, permissions) */}
      {dbError && (
        <div className="mx-4 mt-3 flex items-start gap-2 p-3 bg-amber-900/30 border border-amber-800/50 text-amber-200 rounded-xl text-sm">
          <ShieldAlert size={18} className="shrink-0 mt-0.5" />
          <p className="flex-1">{dbError}</p>
          <button onClick={() => setDbError('')} aria-label="Dismiss" className="p-0.5 text-amber-300/70 hover:text-amber-200">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">

        {/* TAB 1: ROSTER */}
        {activeTab === 'roster' && (
          <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <form onSubmit={addPlayer} className="flex gap-2 relative">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Add new player..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={!newPlayerName.trim()}
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
                  <p className="text-slate-500 text-sm">Your roster is empty. Loading default roster...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {players.map(player => (
                    <div key={player.id} className="flex items-center justify-between bg-slate-800/80 pl-3 pr-1 py-1.5 rounded-xl border border-slate-700/50">
                      <span className="font-medium text-sm truncate pr-2">{player.name}</span>
                      <button
                        onClick={() => removePlayer(player.id)}
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
        )}

        {/* TAB 2: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Who is playing?
              </h2>
              <span className="bg-orange-500/20 text-orange-400 text-xs font-bold px-3 py-1 rounded-full">
                {presentCount} Present
              </span>
            </div>

            {players.length > 0 && (
              <div className="flex gap-2 mb-1">
                <button
                  onClick={() => setAllPresence(true)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700/50 transition-colors active:scale-95"
                >
                  <Check size={16} className="text-orange-400" /> Select All
                </button>
                <button
                  onClick={() => setAllPresence(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700/50 transition-colors active:scale-95"
                >
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
                {players.map(player => (
                  <button
                    key={player.id}
                    onClick={() => togglePresence(player.id, player.isPresent)}
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
        )}

        {/* TAB 3: TABLES */}
        {activeTab === 'tables' && (
          <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">

            {/* Manual round: tables the group already started */}
            <ManualTables
              presentPlayers={presentPlayers}
              manualTables={manualTables.map(t => t.map(p => p.id))}
              onChange={setManualIds}
              onSave={saveManualRound}
              saveBlockReason={manualBlockReason || (sessionId ? '' : 'Connecting…')}
            />

            {/* Configuration Options Picker */}
            {currentConfigs.length > 1 && (
              <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                  Table Layout ({presentCount} Players)
                </span>
                <div className="flex flex-wrap gap-2">
                  {currentConfigs.map((config) => {
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
              disabled={!!blockReason || !sessionId}
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

            {sessionRolls.length === 0 && !blockReason && (
              <div className="text-center p-8 mt-4">
                <Dices size={48} className="mx-auto text-slate-800 mb-4" />
                <p className="text-slate-500 text-sm">Hit the button above to assign players to tables.</p>
                <p className="text-slate-600 text-xs mt-2">Currently selecting {presentCount} players.</p>
              </div>
            )}

            {/* History Feed */}
            {sessionRolls.length > 0 && (
              <div className="mt-2 flex flex-col gap-6">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-slate-500">
                    Session: {sessionRolls.length} roll{sessionRolls.length > 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={undoLastRoll}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors active:scale-95"
                    >
                      <Undo2 size={14} className="text-orange-400" /> Undo last
                    </button>
                    <button
                      onClick={startNewSession}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors active:scale-95"
                    >
                      <RotateCcw size={14} className="text-slate-500" /> New session
                    </button>
                  </div>
                </div>

                {sessionRolls.map((historyItem, hIndex) => {
                  const isLatest = hIndex === 0;
                  const prevTableMap = isLatest ? getPrevTableMap(historyItem, sessionRolls[hIndex + 1]) : null;
                  return (
                    <div key={historyItem.id} className={`relative flex flex-col gap-3 ${!isLatest ? 'opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all duration-300' : ''}`}>

                      <div className="flex items-center justify-between px-1 border-b border-slate-800 pb-2">
                        <h2 className={`text-sm font-bold uppercase tracking-wider ${isLatest ? 'text-orange-400' : 'text-slate-500'}`}>
                          {isLatest ? 'Current Roll' : `Previous Roll`}
                          {historyItem.tables.every(t => t.manual) && ' · Manual'}
                        </h2>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded-md border border-slate-800">
                          <Clock size={12} />
                          {formatTimestamp(new Date(historyItem.createdAt))}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {historyItem.tables.map((table, index) => (
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
                                  const moved = !!prevTableMap
                                    && !table.manual
                                    && prevTableMap[player.id] !== undefined
                                    && prevTableMap[player.id] !== index;
                                  return (
                                    <li key={player.id} className="flex items-center gap-2 text-slate-200">
                                      <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                                        {pIndex + 1}
                                      </span>
                                      <span className={`font-medium text-sm truncate ${moved ? 'text-orange-300' : ''}`}>
                                        {player.name}
                                      </span>
                                      {moved && (
                                        <ArrowRightLeft size={12} className="text-orange-500 shrink-0 ml-auto" />
                                      )}
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
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 w-full bg-slate-900 border-t border-slate-800 flex justify-between px-2 pb-safe pt-2 z-30">
        <NavButton
          icon={<Users />}
          label="Roster"
          isActive={activeTab === 'roster'}
          onClick={() => setActiveTab('roster')}
        />
        <NavButton
          icon={<CheckSquare />}
          label="Present"
          isActive={activeTab === 'attendance'}
          onClick={() => setActiveTab('attendance')}
          badge={presentCount > 0 ? presentCount : null}
        />
        <NavButton
          icon={<Dices />}
          label="Tables"
          isActive={activeTab === 'tables'}
          onClick={() => setActiveTab('tables')}
        />
      </div>
    </div>
  );
}

// Sub-component for Bottom Nav Button
function NavButton({ icon, label, isActive, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex flex-col items-center justify-center py-3 px-1 gap-1 transition-colors ${
        isActive ? 'text-orange-500' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}>
        {React.cloneElement(icon, { size: 22 })}
      </div>
      <span className="text-[10px] font-medium tracking-wide">{label}</span>

      {badge !== null && badge !== undefined && (
        <span className="absolute top-1 right-1/4 translate-x-1/2 -translate-y-1 bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-slate-900">
          {badge}
        </span>
      )}
    </button>
  );
}
