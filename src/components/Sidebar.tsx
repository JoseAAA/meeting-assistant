import React from 'react';
import { Meeting, Category } from '../types';
import { Briefcase, Users, Lightbulb, Plus, MessageSquare, Trash2 } from 'lucide-react';

interface SidebarProps {
  meetings: Meeting[];
  selectedMeetingId: string | null;
  onSelectMeeting: (id: string | null) => void;
  onDeleteMeeting: (id: string) => void;
}

export function Sidebar({ meetings, selectedMeetingId, onSelectMeeting, onDeleteMeeting }: SidebarProps) {
  const categories: { name: Category; icon: React.ReactNode }[] = [
    { name: 'Trabajo', icon: <Briefcase size={16} /> },
    { name: 'Vida Social', icon: <Users size={16} /> },
    { name: 'Proyectos Personales', icon: <Lightbulb size={16} /> },
  ];

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 h-screen flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <MessageSquare className="text-emerald-500" />
          MeetMind
        </h1>
      </div>

      <div className="p-4">
        <button
          onClick={() => onSelectMeeting(null)}
          className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedMeetingId === null
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
          }`}
        >
          <Plus size={18} />
          Nueva Reunión
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {categories.map((cat) => {
          const catMeetings = meetings.filter((m) => m.category === cat.name);
          return (
            <div key={cat.name}>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                {cat.icon}
                {cat.name}
              </h2>
              {catMeetings.length === 0 ? (
                <p className="text-sm text-zinc-600 italic px-2">Sin reuniones</p>
              ) : (
                <ul className="space-y-1">
                  {catMeetings.map((meeting) => (
                    <li key={meeting.id} className="group relative">
                      <button
                        onClick={() => onSelectMeeting(meeting.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors pr-8 ${
                          selectedMeetingId === meeting.id
                            ? 'bg-zinc-800 text-emerald-400 font-medium'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        {meeting.title}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMeeting(meeting.id);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
