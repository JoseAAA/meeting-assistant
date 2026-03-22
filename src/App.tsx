import React, { useState, useEffect } from 'react';
import { Meeting } from './types';
import { Sidebar } from './components/Sidebar';
import { NewMeetingForm } from './components/NewMeetingForm';
import { MeetingView } from './components/MeetingView';
import { Menu, X } from 'lucide-react';

export default function App() {
  const [meetings, setMeetings] = useState<Meeting[]>(() => {
    const saved = localStorage.getItem('ibt-meetings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('ibt-meetings', JSON.stringify(meetings));
  }, [meetings]);

  const handleMeetingCreated = (meeting: Meeting) => {
    setMeetings((prev) => [meeting, ...prev]);
    setSelectedMeetingId(meeting.id);
    setIsMobileMenuOpen(false);
  };

  const handleDeleteMeeting = (id: string) => {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    if (selectedMeetingId === id) {
      setSelectedMeetingId(null);
    }
  };

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);

  const handleUpdateMeeting = (updatedMeeting: Meeting) => {
    setMeetings((prev) => prev.map(m => m.id === updatedMeeting.id ? updatedMeeting : m));
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50 font-sans overflow-hidden relative">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 absolute top-0 left-0 right-0 z-20">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <span className="text-emerald-500">MeetMind</span>
        </h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-zinc-400 hover:text-zinc-100"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className={`fixed md:relative z-40 h-full transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <Sidebar
          meetings={meetings}
          selectedMeetingId={selectedMeetingId}
          onSelectMeeting={(id) => {
            setSelectedMeetingId(id);
            setIsMobileMenuOpen(false);
          }}
          onDeleteMeeting={handleDeleteMeeting}
        />
      </div>
      
      <main className="flex-1 p-4 sm:p-8 pt-20 md:pt-8 overflow-y-auto relative w-full">
        {selectedMeeting ? (
          <MeetingView meeting={selectedMeeting} onUpdateMeeting={handleUpdateMeeting} />
        ) : (
          <NewMeetingForm onMeetingCreated={handleMeetingCreated} />
        )}
      </main>
    </div>
  );
}
