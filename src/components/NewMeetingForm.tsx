import React, { useState, useRef } from 'react';
import { Category } from '../types';
import { FileText, Mic, Upload, Send, Loader2, StopCircle } from 'lucide-react';
import { generateSummary, transcribeAudio, generateTitle } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import * as mammoth from 'mammoth';

interface NewMeetingFormProps {
  onMeetingCreated: (meeting: any) => void;
}

export function NewMeetingForm({ onMeetingCreated }: NewMeetingFormProps) {
  const [category, setCategory] = useState<Category>('Trabajo');
  const [inputType, setInputType] = useState<'text' | 'file' | 'record'>('text');
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'mic' | 'meeting'>('mic');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [extraInstructions, setExtraInstructions] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const startRecording = async (mode: 'mic' | 'meeting') => {
    try {
      setError(null);
      setRecordingMode(mode);
      const streams: MediaStream[] = [];
      let mixedStream: MediaStream;

      if (mode === 'meeting') {
        if (!navigator.mediaDevices.getDisplayMedia) {
          throw new Error("Tu navegador o dispositivo no soporta la captura de audio del sistema (ej. móviles o Safari antiguo). Por favor, usa la opción 'Grabar solo mi voz'.");
        }

        // 1. Get Screen/Tab Audio
        let displayStream;
        try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "browser" }, // Needed to prompt for tab
            audio: true
          });
        } catch (e: any) {
          // If the user cancelled the prompt, we shouldn't show a scary error, 
          // just reset the state so they can try again.
          if (e.name === 'NotAllowedError' || e.message.includes('cancel')) {
            setRecordingMode(null);
            return; // Exit silently
          }
          throw new Error("Se canceló la captura de pantalla o no se dieron permisos.");
        }

        if (displayStream.getAudioTracks().length === 0) {
           displayStream.getTracks().forEach(t => t.stop());
           throw new Error("Debes marcar la casilla 'Compartir audio' al seleccionar la pestaña o pantalla.");
        }
        streams.push(displayStream);

        // 2. Get Mic Audio
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streams.push(micStream);

        // 3. Mix them
        const audioCtx = new AudioContext();
        await audioCtx.resume(); // Ensure context is running
        audioContextRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();

        audioCtx.createMediaStreamSource(displayStream).connect(dest);
        audioCtx.createMediaStreamSource(micStream).connect(dest);

        mixedStream = dest.stream;
        streamsRef.current = streams;
      } else {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mixedStream = micStream;
        streamsRef.current = [micStream];
      }

      const options = MediaRecorder.isTypeSupported('audio/webm') 
        ? { mimeType: 'audio/webm', audioBitsPerSecond: 128000 } 
        : { audioBitsPerSecond: 128000 };
      const mediaRecorder = new MediaRecorder(mixedStream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(); // Collect all at once at the end
      setIsRecording(true);
    } catch (err: any) {
      setError(err.message || 'No se pudo acceder al micrófono o al audio del sistema.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        // Wait a tiny bit to ensure ondataavailable has fired
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (audioChunksRef.current.length === 0) {
          setError('No se pudo grabar el audio. Por favor, intenta de nuevo.');
          setIsRecording(false);
          return;
        }

        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        let cleanMimeType = mimeType.split(';')[0]; // Remove codecs for Gemini API
        if (!cleanMimeType || cleanMimeType === 'audio/x-matroska') {
          cleanMimeType = 'audio/webm';
        }
        const extension = cleanMimeType.includes('mp4') ? 'mp4' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioFile = new File([audioBlob], `recording.${extension}`, { type: cleanMimeType });
        setFile(audioFile);
        setIsRecording(false);
        
        // Clean up streams
        streamsRef.current.forEach(stream => stream.getTracks().forEach(track => track.stop()));
        streamsRef.current = [];
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Transcribe audio immediately
        setIsProcessing(true);
        setProcessingMessage('Transcribiendo audio...');
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          });
          reader.readAsDataURL(audioFile);
          const base64data = await base64Promise;
          
          const transcription = await transcribeAudio({ data: base64data, mimeType: audioFile.type });
          setTextInput(transcription);
          setInputType('text'); // Switch to text mode to show transcription
          setFile(null); // Clear file since we have text now
        } catch (err) {
          setError('Error al transcribir el audio.');
          console.error(err);
        } finally {
          setIsProcessing(false);
        }
      };
      mediaRecorderRef.current.stop();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput && !file) {
      setError('Por favor, ingresa texto o sube un archivo.');
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Generando resumen...');
    setError(null);

    try {
      let fileData;
      let additionalText = textInput;

      if (file) {
        if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // Extract text from DOCX
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          additionalText = additionalText ? `${additionalText}\n\n${result.value}` : result.value;
        } else {
          // Pass other files (PDF, audio, etc.) to Gemini directly
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          });
          reader.readAsDataURL(file);
          const base64 = await base64Promise;
          fileData = { data: base64, mimeType: file.type };
        }
      }

      const summary = await generateSummary(additionalText, fileData, category, extraInstructions);
      const title = await generateTitle(summary);
      
      const newMeeting = {
        id: uuidv4(),
        title,
        date: new Date().toISOString(),
        category,
        summary,
        originalText: additionalText,
      };

      onMeetingCreated(newMeeting);
    } catch (err: any) {
      setError(`Error al procesar la reunión: ${err.message || 'Por favor, intenta de nuevo.'}`);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl">
      <h2 className="text-2xl font-bold text-zinc-100 mb-6">Analizar Nueva Reunión</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Categoría</label>
          <div className="flex flex-wrap gap-4">
            {(['Trabajo', 'Vida Social', 'Proyectos Personales'] as Category[]).map((cat) => (
              <label key={cat} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value={cat}
                  checked={category === cat}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="text-emerald-500 focus:ring-emerald-500 bg-zinc-800 border-zinc-700"
                />
                <span className="text-zinc-300">{cat}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Método de Entrada</label>
          <div className="flex flex-wrap gap-2 p-1 bg-zinc-800 rounded-lg w-full sm:w-fit">
            <button
              type="button"
              onClick={() => setInputType('text')}
              className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                inputType === 'text' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText size={16} /> Texto
            </button>
            <button
              type="button"
              onClick={() => setInputType('file')}
              className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                inputType === 'file' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Upload size={16} /> Archivo
            </button>
            <button
              type="button"
              onClick={() => setInputType('record')}
              className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                inputType === 'record' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Mic size={16} /> Grabar
            </button>
          </div>
        </div>

        {inputType === 'text' && (
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Contenido (Notas, Transcripción)</label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="w-full h-48 bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              placeholder="Pega aquí el texto de la reunión..."
            />
          </div>
        )}

        {inputType === 'file' && (
          <div className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center bg-zinc-800/50">
            <Upload className="mx-auto h-12 w-12 text-zinc-500 mb-4" />
            <div className="flex text-sm text-zinc-400 justify-center">
              <label className="relative cursor-pointer rounded-md font-medium text-emerald-500 hover:text-emerald-400">
                <span>Sube un archivo</span>
                <input type="file" className="sr-only" onChange={handleFileChange} accept=".txt,.pdf,.docx,audio/*" />
              </label>
              <p className="pl-1">o arrastra y suelta</p>
            </div>
            <p className="text-xs text-zinc-500 mt-2">PDF, TXT, DOCX o Audio (MP3, WAV, M4A)</p>
            {file && <p className="mt-4 text-sm text-emerald-400 font-medium">Archivo seleccionado: {file.name}</p>}
          </div>
        )}

        {inputType === 'record' && (
          <div className="border border-zinc-700 rounded-lg p-6 text-center bg-zinc-800/50 flex flex-col items-center justify-center min-h-[200px]">
            {isRecording ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center animate-pulse mb-4">
                  <Mic className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-red-400 font-medium mb-2">Grabando {recordingMode === 'meeting' ? 'Reunión' : 'Micrófono'}...</p>
                {recordingMode === 'meeting' && <p className="text-xs text-zinc-400 mb-4">Capturando audio del sistema y tu micrófono</p>}
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors mt-2"
                >
                  <StopCircle size={18} /> Detener y Transcribir
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full max-w-md">
                <div className="w-16 h-16 bg-zinc-700 rounded-full flex items-center justify-center mb-4">
                  <Mic className="h-8 w-8 text-zinc-400" />
                </div>
                <p className="text-zinc-300 mb-6 text-sm">¿Qué deseas grabar?</p>
                
                <div className="flex flex-col gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => startRecording('mic')}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors font-medium w-full"
                  >
                    <Mic size={18} /> Grabar solo mi voz (Micrófono)
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => startRecording('meeting')}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium w-full"
                  >
                    <Upload size={18} /> Grabar Reunión (Pestaña + Micrófono)
                  </button>
                </div>
                
                <div className="mt-6 text-xs text-zinc-500 text-left bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                  <p className="font-semibold text-zinc-400 mb-1">💡 Para grabar reuniones (Meet/Teams) con audífonos:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Elige <strong>Grabar Reunión</strong>.</li>
                    <li>Selecciona la pestaña donde está la reunión.</li>
                    <li><strong>¡Importante!</strong> Marca la casilla "Compartir audio de la pestaña".</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Instrucciones Adicionales (Opcional)</label>
          <input
            type="text"
            value={extraInstructions}
            onChange={(e) => setExtraInstructions(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="Ej: Enfocate en las tareas técnicas, priorizá los riesgos..."
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={isProcessing || (inputType === 'record' && isRecording)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" size={18} /> {processingMessage}
            </>
          ) : (
            <>
              <Send size={18} /> Generar Resumen
            </>
          )}
        </button>
      </form>
    </div>
  );
}
