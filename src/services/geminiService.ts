import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
# Instrucciones del Proyecto — Asistente de Reuniones IBT GROUP

## Quién soy
Soy científico de datos en IBT GROUP, empresa de salud. Trabajo con equipos técnicos y de negocio. Mis reuniones son variadas: sprints, stakeholders, KPIs, research con usuarios, retrospectivas, kickoffs, relevamiento de proyectos y reuniones de equipo.

## Tu rol
Sos mi asistente de reuniones. Cuando te comparta el contenido de una reunión (texto, transcripción, audio o documento), tu trabajo es analizarlo y darme un resumen accionable, claro y directo. No quiero apuntes — quiero entender qué pasó, qué tengo que hacer y qué valor puedo extraer.

---

## Qué hacer cuando recibas una reunión

Siempre respondé con esta estructura, en español, en el mismo orden:

### 🧭 De qué se trató
Una o dos oraciones. Qué tipo de reunión fue, quiénes participaron (si se menciona) y cuál era el objetivo.

### 💡 Valor clave
Lo más importante que salió de esta reunión. Una sola idea: la decisión, el insight, el hallazgo o el acuerdo que más importa. Esto debe ser algo que pueda usar o presentar.

### 📌 Puntos clave
Lista de 3 a 6 puntos. Cada uno con una oración clara. Solo lo que realmente importa, sin relleno.

### ✅ Tareas
Tabla con columnas: Tarea | Responsable | Plazo | Prioridad (urgente / alta / media / baja)
Si no se mencionó responsable o plazo, poner "—". Ordenadas de mayor a menor prioridad.

### 🤝 Acuerdos
Lo que quedó decidido o comprometido. Indicar si está confirmado, pendiente o es una propuesta.

### 💡 Propuestas / Soluciones
Si en la reunión surgió algún problema con propuesta de solución, describilo así:
- **Problema:** qué se identificó
- **Propuesta:** qué se sugirió
- **Pasos concretos:** cómo ejecutarlo
- **Recursos necesarios:** qué hace falta

### ⚠️ Riesgos o bloqueos
Lo que puede frenar el avance. Si no hay ninguno claro, omitir esta sección.

### 🗺️ Próximos pasos
Lista numerada. Qué debe pasar después de esta reunión, en orden lógico.

---

## Reglas de formato
- Usá lenguaje directo y concreto. Nada de frases genéricas como "se conversó sobre la importancia de..."
- Si algo no quedó claro en la reunión, marcalo con ⚠️ "Pendiente de aclarar: ..."
- Si detectás que faltó definir algo importante (responsable, plazo, decisión), señalalo al final con una nota breve
- Máximo una pantalla de lectura. Si la reunión fue corta, el resumen debe ser corto también
`;

export async function generateSummary(
  text: string,
  fileData?: { data: string; mimeType: string },
  category?: string,
  extraInstructions?: string
) {
  const parts: any[] = [];
  
  if (fileData) {
    parts.push({
      inlineData: {
        data: fileData.data,
        mimeType: fileData.mimeType,
      },
    });
  }
  
  if (text) {
    parts.push({ text });
  }

  let categoryInstructions = "";
  if (category === "Trabajo") {
    categoryInstructions = `
### 🧭 De qué se trató (Contexto)
### 💡 Valor clave (Decisión o insight principal)
### 📌 Puntos clave (Lista de temas discutidos)
### ✅ Tareas (Lista de tareas con viñetas normales: - Tarea — Responsable — Plazo)
### 🤝 Acuerdos (Decisiones tomadas)
### ⚠️ Riesgos o bloqueos
### 🗺️ Próximos pasos
`;
  } else if (category === "Proyectos Personales") {
    categoryInstructions = `
### 🎯 Objetivo del Proyecto (De qué trata esta sesión)
### 💡 Ideas e Insights (Nuevos descubrimientos o ideas creativas)
### 🛠️ Tareas y Siguientes Pasos (Lista con viñetas normales: - Tarea)
### 🚧 Obstáculos (Qué me está frenando)
### 📚 Recursos o Referencias (Cosas para investigar o leer)
`;
  } else if (category === "Vida Social") {
    categoryInstructions = `
### 🗣️ Resumen de la charla (De qué hablamos)
### 📅 Planes futuros (Salidas, eventos, fechas acordadas)
### 🍿 Recomendaciones (Películas, libros, lugares mencionados)
### 💡 Detalles importantes (Cosas para recordar sobre la otra persona)
`;
  } else {
    categoryInstructions = `
### 🧭 Resumen General
### 📌 Puntos clave
### ✅ Acciones a tomar
`;
  }

  const dynamicSystemInstruction = `
# Instrucciones del Proyecto — Asistente de Reuniones (MeetMind)

## Tu rol
Sos mi asistente personal. Cuando te comparta el contenido de una reunión, charla o nota de voz, tu trabajo es analizarlo y darme un resumen estructurado, claro y directo.

## Estructura requerida
Debes responder SIEMPRE usando la siguiente estructura de encabezados Markdown (usa ### para los títulos), dependiendo de la categoría de la reunión:

${categoryInstructions}

## Reglas de formato
- Usa encabezados de nivel 3 (###) para las secciones. NUNCA uses # o ## para evitar que el texto se vea gigante.
- Usá lenguaje directo y concreto.
- Si una sección no aplica o no hay información, omítela o pon "No se mencionaron detalles."
- Usa listas con viñetas (-) o tablas cuando sea apropiado para facilitar la lectura.
`;

  let prompt = `Analiza el siguiente contenido de una reunión de la categoría: ${category || 'General'}.`;
  if (extraInstructions) {
    prompt += `\nInstrucciones adicionales: ${extraInstructions}`;
  }

  parts.unshift({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      systemInstruction: dynamicSystemInstruction,
    },
  });

  return response.text;
}

export async function transcribeAudio(fileData: { data: string; mimeType: string }) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: fileData.data,
            mimeType: fileData.mimeType,
          },
        },
        { text: `INSTRUCCIONES ESTRICTAS:
1. Escucha el audio adjunto.
2. Traduce todo lo que se diga DIRECTAMENTE AL ESPAÑOL.
3. NO incluyas la transcripción en el idioma original (inglés, etc.). Escribe ÚNICAMENTE la versión en español.
4. Identifica a los hablantes si es posible (ej. Hablante 1:, Hablante 2:).
5. CRÍTICO: Si el audio está en silencio, solo tiene ruido de fondo, o no hay voces humanas claras, DEBES responder EXACTAMENTE con "(No se detectó voz)". NO inventes conversaciones ni texto aleatorio.` },
      ],
    },
  });

  return response.text;
}

export async function generateSpeech(text: string) {
  // First, generate a short, conversational summary suitable for text-to-speech
  // to avoid hitting limits and to provide a better listening experience.
  const summaryResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Crea un resumen muy breve y conversacional (máximo 3 oraciones) del siguiente texto, diseñado para ser leído en voz alta por un asistente virtual:\n\n${text}`,
  });
  
  const shortSummary = summaryResponse.text || "No se pudo generar el resumen para audio.";

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: shortSummary }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}

export async function chatAboutMeeting(meetingContext: string, message: string, history: {role: string, parts: {text: string}[]}[] = []) {
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `Eres un asistente que responde preguntas sobre una reunión específica. Aquí está el resumen de la reunión para contexto:\n\n${meetingContext}`,
    },
  });

  // Replay history if needed, though the SDK might not support passing history directly to create easily without formatting.
  // For simplicity, we'll just send the message with context if history is empty, or just rely on the system instruction.
  
  const response = await chat.sendMessage({ message });
  return response.text;
}

export async function generateTitle(summary: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Actúa como un asistente ejecutivo. Lee el siguiente resumen de una reunión y genera un título muy corto (máximo 5 palabras) que describa exactamente de qué trató la reunión de forma profesional (ej: "Planificación Q3", "Entrevista Usuario"). No uses comillas ni puntos finales.\n\nResumen:\n${summary}`,
  });
  return response.text?.replace(/["']/g, '').trim() || 'Reunión sin título';
}

export function connectLiveAPI(
  meetingContext: string,
  callbacks: {
    onopen: () => void;
    onmessage: (message: any) => void;
    onerror: (error: any) => void;
    onclose: () => void;
  }
) {
  return ai.live.connect({
    model: "gemini-2.5-flash-native-audio-preview-12-2025",
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
      },
      systemInstruction: `Eres un asistente de reuniones. Aquí está el resumen de la reunión para contexto:\n\n${meetingContext}\n\nResponde a las preguntas del usuario de forma concisa y útil.`,
    },
  });
}
