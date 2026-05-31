import React, { useState, useEffect, useRef } from 'react';
import { Users, CheckSquare, Dices, UserPlus, Trash2, ShieldAlert, Clock, ArrowRightLeft, Check, X } from 'lucide-react';
import { 
  initializeApp 
} from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';

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

// --- Table Configurations (1-20 players) ---
const TABLE_CONFIGS = {
  3: [[3]],
  4: [[4]],
  5: [[5]],
  6: [[3, 3], [6]],
  7: [[4, 3]],
  8: [[4, 4]],
  9: [[3, 3, 3], [5, 4]],
  10: [[4, 3, 3], [5, 5]],
  11: [[4, 4, 3]],
  12: [[4, 4, 4], [3, 3, 3, 3], [6, 6]],
  13: [[4, 3, 3, 3], [5, 4, 4]],
  14: [[4, 4, 3, 3], [5, 5, 4]],
  15: [[4, 4, 4, 3], [5, 5, 5], [3, 3, 3, 3, 3]],
  16: [[4, 4, 4, 4]],
  17: [[4, 4, 4, 5], [4, 4, 3, 3, 3]], // Adjusted slightly to put 5 at end
  18: [[4, 4, 4, 3, 3], [5, 5, 4, 4], [3, 3, 3, 3, 3, 3]],
  19: [[4, 4, 4, 4, 3], [5, 5, 5, 4]],
  20: [[4, 4, 4, 4, 4], [5, 5, 5, 5]]
};

export default function App() {
  const [user, setUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [activeTab, setActiveTab] = useState('attendance'); 
  const [generatedTables, setGeneratedTables] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedConfigIndex, setSelectedConfigIndex] = useState(0);
  const hasInjectedDefault = useRef(false);

  const presentCount = players.filter(p => p.isPresent).length;

  // Auto-reset config index if player count changes
  useEffect(() => {
    setSelectedConfigIndex(0);
  }, [presentCount]);

  // --- Auth & Data Fetching ---
  useEffect(() => {
    if (!auth) return;

    const initAuth = async () => {
      try {
        const authToken = import.meta.env.VITE_INITIAL_AUTH_TOKEN;
        if (authToken) {
          await signInWithCustomToken(auth, authToken);
        } else {
          await signInAnonymously(auth);
        }
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
    const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
    
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
      } catch (e) { console.error(e); }
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

  // --- Handlers ---
  const addPlayer = async (e) => {
    e.preventDefault();
    const nameToAdd = newPlayerName.trim();
    if (!nameToAdd || !user) return;

    // Instant clear
    setNewPlayerName('');

    const newId = crypto.randomUUID();
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', newId);
    
    try {
      await setDoc(playerRef, {
        name: nameToAdd,
        isPresent: true 
      });
    } catch (err) {
      console.error("Error adding player:", err);
    }
  };

  const removePlayer = async (id) => {
    if (!user) return;
    try {
      const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', id);
      await deleteDoc(playerRef);
    } catch (err) {
      console.error("Error removing player:", err);
    }
  };

  const togglePresence = async (id, currentStatus) => {
    if (!user) return;
    try {
      const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', id);
      await setDoc(playerRef, { isPresent: !currentStatus }, { merge: true });
    } catch (err) {
      console.error("Error toggling presence:", err);
    }
  };

  const setAllPresence = async (status) => {
    if (!user || players.length === 0) return;
    try {
      const promises = players.map(player => {
        if (player.isPresent !== status) {
          const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', player.id);
          return setDoc(playerRef, { isPresent: status }, { merge: true });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
    } catch (err) {
      console.error("Error setting bulk presence:", err);
    }
  };

  // --- Generation Algorithm ---
  const formatTimestamp = (date) => {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const getPreviousPairs = (lastGen) => {
    if (!lastGen) return new Set();
    const pairs = new Set();
    lastGen.tables.forEach(table => {
      for (let i = 0; i < table.length; i++) {
        for (let j = i + 1; j < table.length; j++) {
          const key = [table[i].id, table[j].id].sort().join('-');
          pairs.add(key);
        }
      }
    });
    return pairs;
  };

  const getPreviousTableMap = (lastGen) => {
    if (!lastGen) return {};
    const map = {};
    lastGen.tables.forEach((table, index) => {
      table.forEach(player => {
        map[player.id] = index;
      });
    });
    return map;
  };

  const getFallbackConfig = (count) => {
    const numTables = Math.ceil(count / 4);
    const baseSize = Math.floor(count / numTables);
    let remainder = count % numTables;
    const layout = [];
    for (let i = 0; i < numTables; i++) {
      layout.push(baseSize + (remainder > 0 ? 1 : 0));
      if (remainder > 0) remainder--;
    }
    return [layout];
  };

  const getCurrentConfigs = () => {
    if (presentCount < 3) return [];
    return TABLE_CONFIGS[presentCount] || getFallbackConfig(presentCount);
  };

  const currentConfigs = getCurrentConfigs();
  const activeLayout = currentConfigs[selectedConfigIndex] || currentConfigs[0];

  const chunkPlayersWithLayout = (shuffled, layout) => {
    const tables = [];
    let startIndex = 0;
    for (const size of layout) {
      tables.push(shuffled.slice(startIndex, startIndex + size));
      startIndex += size;
    }
    return tables;
  };

  const generateTables = () => {
    const presentPlayers = players.filter(p => p.isPresent);
    const count = presentPlayers.length;
    setErrorMsg('');

    if (count < 3) {
      setErrorMsg(`Need at least 3 players. Currently have ${count}.`);
      return;
    }

    if (!activeLayout) return;

    // Capture the current context to compare with the previous roll
    const currentPlayerIds = presentPlayers.map(p => p.id).sort().join(',');
    const currentLayoutStr = activeLayout.join(',');

    const prevGeneration = generatedTables[0];
    const prevPairs = getPreviousPairs(prevGeneration);
    const prevTableMap = getPreviousTableMap(prevGeneration);

    // Check if the exact same players and table layout are being used
    let isSameContext = false;
    if (prevGeneration && prevGeneration.playerIds === currentPlayerIds && prevGeneration.layout === currentLayoutStr) {
      isSameContext = true;
    }

    let bestScore = -1;
    let bestTables = [];

    // Generate 100 random shuffles and pick the one with the lowest overlap score
    for (let i = 0; i < 100; i++) {
      const shuffled = [...presentPlayers].sort(() => Math.random() - 0.5);
      const candidateTables = chunkPlayersWithLayout(shuffled, activeLayout);
      
      let overlapScore = 0;
      candidateTables.forEach(table => {
        for (let j = 0; j < table.length; j++) {
          for (let k = j + 1; k < table.length; k++) {
            const key = [table[j].id, table[k].id].sort().join('-');
            if (prevPairs.has(key)) overlapScore++;
          }
        }
      });

      if (bestScore === -1 || overlapScore < bestScore) {
        bestScore = overlapScore;
        bestTables = candidateTables;
      }
      if (bestScore === 0) break; // Perfect shuffle found
    }

    // Flag players who moved tables compared to the immediate last generation
    // ONLY if the context (player list and layout) remained the exact same.
    bestTables.forEach((table, tIndex) => {
      table.forEach(player => {
        if (isSameContext) {
          const oldTIndex = prevTableMap[player.id];
          player.moved = oldTIndex !== undefined && oldTIndex !== tIndex;
        } else {
          player.moved = false; // Disable highlighting if context changed
        }
      });
    });

    const newHistoryItem = {
      id: crypto.randomUUID(),
      timestamp: formatTimestamp(new Date()),
      tables: bestTables,
      playerIds: currentPlayerIds,
      layout: currentLayoutStr
    };

    setGeneratedTables([newHistoryItem, ...generatedTables]);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans mx-auto max-w-md w-full relative overflow-hidden shadow-2xl shadow-black">
      
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 pt-6 shrink-0 flex items-center justify-between z-10">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
            Commander Tables
          </h1>
          <p className="text-xs text-slate-500 mt-1">Randomize your MTG pods</p>
        </div>
      </div>

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
            
            {/* Configuration Options Picker */}
            {currentConfigs.length > 1 && (
              <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                  Table Layout ({presentCount} Players)
                </span>
                <div className="flex flex-wrap gap-2">
                  {currentConfigs.map((config, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedConfigIndex(idx)}
                      className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold border transition-colors ${
                        selectedConfigIndex === idx 
                          ? 'bg-orange-600/20 border-orange-500 text-orange-300' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {config.join(' / ')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={generateTables}
              disabled={presentCount < 3}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-orange-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <Dices size={24} />
              <span className="text-lg">Randomize Tables</span>
            </button>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800/50 text-red-300 rounded-xl text-sm">
                <ShieldAlert size={18} className="shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            {generatedTables.length === 0 && !errorMsg && (
              <div className="text-center p-8 mt-4">
                <Dices size={48} className="mx-auto text-slate-800 mb-4" />
                <p className="text-slate-500 text-sm">Hit the button above to assign players to tables.</p>
                <p className="text-slate-600 text-xs mt-2">Currently selecting {presentCount} players.</p>
              </div>
            )}

            {/* History Feed */}
            {generatedTables.length > 0 && (
              <div className="mt-2 flex flex-col gap-6">
                {generatedTables.map((historyItem, hIndex) => {
                  const isLatest = hIndex === 0;
                  return (
                    <div key={historyItem.id} className={`relative flex flex-col gap-3 ${!isLatest ? 'opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all duration-300' : ''}`}>
                      
                      <div className="flex items-center justify-between px-1 border-b border-slate-800 pb-2">
                        <h2 className={`text-sm font-bold uppercase tracking-wider ${isLatest ? 'text-orange-400' : 'text-slate-500'}`}>
                          {isLatest ? 'Current Roll' : `Previous Roll`}
                        </h2>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded-md border border-slate-800">
                          <Clock size={12} />
                          {historyItem.timestamp}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {historyItem.tables.map((table, index) => (
                          <div key={index} className="bg-slate-800/60 rounded-2xl border border-slate-700 overflow-hidden shadow-lg flex flex-col h-full">
                            <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex justify-between items-center shrink-0">
                              <h3 className={`font-bold text-sm ${isLatest ? 'text-orange-300' : 'text-slate-300'}`}>
                                Table {index + 1}
                              </h3>
                              <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 font-medium">
                                {table.length} P
                              </span>
                            </div>
                            <div className="p-3 flex-1">
                              <ul className="flex flex-col gap-2">
                                {table.map((player) => (
                                  <li key={player.id} className="flex items-center gap-2 text-slate-200">
                                    <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                                      {table.indexOf(player) + 1}
                                    </span>
                                    <span className={`font-medium text-sm truncate ${isLatest && player.moved ? 'text-orange-300' : ''}`}>
                                      {player.name}
                                    </span>
                                    {isLatest && player.moved && (
                                      <ArrowRightLeft size={12} className="text-orange-500 shrink-0 ml-auto" />
                                    )}
                                  </li>
                                ))}
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
      <div className="absolute bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 flex justify-between px-2 pb-safe pt-2 z-20">
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