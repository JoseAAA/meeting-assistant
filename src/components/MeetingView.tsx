import React, { useState, useRef, useEffect } from 'react';
import { Meeting, ChatMessage } from '../types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Play, Square, MessageSquare, Send, Loader2, Copy, Check } from 'lucide-react';
import { generateSpeech, chatAboutMeeting } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

interface MeetingViewProps {
  meeting: Meeting;
  onUpdateMeeting?: (updatedMeeting: Meeting) => void;
}

export function MeetingView({ meeting, onUpdateMeeting }: MeetingViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset state when meeting changes
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsPlaying(false);
    setChatMessages([]);
    setChatInput('');
  }, [meeting.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handlePlayAudio = async () => {
    if (isPlaying && audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
      setIsPlaying(false);
      return;
    }

    setIsGeneratingAudio(true);
    setAudioError(null);
    try {
      const base64Audio = await generateSpeech(meeting.summary);
      if (base64Audio) {
        const binaryString = window.atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = audioContext;

        // Check if it's WAV (RIFF header)
        const isWav = bytes.length > 4 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70;

        let audioBuffer: AudioBuffer;
        if (isWav) {
          audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        } else {
          // Assume raw 16-bit PCM, 24000Hz, mono
          const int16Array = new Int16Array(bytes.buffer);
          audioBuffer = audioContext.createBuffer(1, int16Array.length, 24000);
          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < int16Array.length; i++) {
            channelData[i] = int16Array[i] / 32768.0;
          }
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => setIsPlaying(false);
        source.start();

        audioSourceRef.current = source;
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      setAudioError('Error al generar el audio. Por favor, intenta de nuevo.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatting(true);

    try {
      // In a real app, we'd pass the full history. For now, we pass the meeting context and the latest message.
      const response = await chatAboutMeeting(meeting.summary, userMsg.content);
      const assistantMsg: ChatMessage = { id: uuidv4(), role: 'assistant', content: response };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMsg: ChatMessage = { id: uuidv4(), role: 'assistant', content: 'Lo siento, hubo un error al procesar tu pregunta.' };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(meeting.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="flex flex-col xl:flex-row h-full gap-6 xl:overflow-hidden">
      {/* Summary Section */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl p-4 sm:p-8 min-h-[500px] xl:min-h-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-6 border-b border-zinc-800 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 mb-2">{meeting.title}</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <span className="px-2 py-1 bg-zinc-800 rounded-md text-emerald-400 font-medium">{meeting.category}</span>
              <span>{new Date(meeting.date).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 rounded-lg transition-colors font-medium"
            >
              {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                showChat 
                  ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
            >
              <MessageSquare size={18} />
              {showChat ? 'Ocultar Chat' : 'Conversar'}
            </button>
            <button
              onClick={handlePlayAudio}
              disabled={isGeneratingAudio}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {isGeneratingAudio ? (
                <Loader2 className="animate-spin" size={18} />
              ) : isPlaying ? (
                <Square size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
              {isGeneratingAudio ? 'Generando...' : isPlaying ? 'Detener' : 'Escuchar'}
            </button>
          </div>
        </div>

        {audioError && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {audioError}
          </div>
        )}

        <div className="prose prose-invert prose-emerald max-w-none prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg break-words">
          <Markdown 
            remarkPlugins={[remarkGfm]}
          >
            {meeting.summary.replace(/^([\s]*)[-*] \[[ xX]\] /gm, '$1- ')}
          </Markdown>
        </div>
      </div>

      {/* Chat Section */}
      {showChat && (
        <div className="w-full xl:w-96 h-[500px] xl:h-auto flex flex-col bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl overflow-hidden shrink-0">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-emerald-500" size={20} />
              <h3 className="font-semibold text-zinc-100">Chat sobre la reunión</h3>
            </div>
            <button 
              onClick={() => setShowChat(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              ×
            </button>
          </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="text-center text-zinc-500 mt-10">
              <p className="text-sm">Pregunta cualquier detalle sobre esta reunión.</p>
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] p-3 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-zinc-700'
                  }`}
                >
                  <div className="prose prose-invert prose-sm max-w-none">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                  </div>
                </div>
              </div>
            ))
          )}
          {isChatting && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 text-zinc-400 p-3 rounded-lg rounded-bl-none border border-zinc-700 flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} /> Pensando...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatting}
              className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
      )}
    </div>
  );
}
