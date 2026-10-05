import { useState, useCallback } from 'react';
import useFirebaseUser from './hooks/useFirebaseUser.js';
import useRoster from './hooks/useRoster.js';
import useRolls from './hooks/useRolls.js';
import useManualTables from './hooks/useManualTables.js';
import useTogetherGroups from './hooks/useTogetherGroups.js';
import ErrorBanner from './components/ErrorBanner.jsx';
import BottomNav from './components/BottomNav.jsx';
import RosterTab from './components/RosterTab.jsx';
import PresentTab from './components/PresentTab.jsx';
import TablesTab from './components/TablesTab.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('attendance');
  const [dbError, setDbError] = useState('');

  const reportError = useCallback((message, err) => {
    console.error(message, err);
    setDbError(message);
  }, []);

  const user = useFirebaseUser();
  const roster = useRoster(user, reportError);
  const { historyRolls, saveRoll } = useRolls(user, reportError);
  const manual = useManualTables(roster.presentPlayers);
  const together = useTogetherGroups(roster.presentPlayers);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200 font-sans w-full relative overflow-hidden shadow-2xl shadow-black">
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 shrink-0 flex items-center justify-between z-10">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
            Commander Tables
          </h1>
          <p className="text-xs text-slate-500 mt-1">Randomize your MTG pods</p>
        </div>
      </div>

      <ErrorBanner message={dbError} onDismiss={() => setDbError('')} />

      <div className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'roster' && (
          <RosterTab players={roster.players} onAdd={roster.addPlayer} onRemove={roster.removePlayer} />
        )}
        {activeTab === 'attendance' && (
          <PresentTab
            players={roster.players}
            presentCount={roster.presentPlayers.length}
            onToggle={roster.togglePresence}
            onSetAll={roster.setAllPresence}
          />
        )}
        {activeTab === 'tables' && (
          <TablesTab
            players={roster.players}
            presentPlayers={roster.presentPlayers}
            historyRolls={historyRolls}
            saveRoll={saveRoll}
            manual={manual}
            together={together}
          />
        )}
      </div>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} presentCount={roster.presentPlayers.length} />
    </div>
  );
}
