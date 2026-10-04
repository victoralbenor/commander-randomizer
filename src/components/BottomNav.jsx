import React from 'react';
import { Users, CheckSquare, Dices } from 'lucide-react';

const TABS = [
  { key: 'roster', label: 'Roster', icon: <Users /> },
  { key: 'attendance', label: 'Present', icon: <CheckSquare /> },
  { key: 'tables', label: 'Tables', icon: <Dices /> },
];

export default function BottomNav({ activeTab, onChange, presentCount }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 w-full bg-slate-900 border-t border-slate-800 flex justify-between px-2 pb-safe pt-2 z-30">
      {TABS.map(({ key, label, icon }) => (
        <NavButton
          key={key}
          icon={icon}
          label={label}
          isActive={activeTab === key}
          onClick={() => onChange(key)}
          badge={key === 'attendance' && presentCount > 0 ? presentCount : null}
        />
      ))}
    </div>
  );
}

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
