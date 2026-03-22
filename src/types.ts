export type Category = 'Trabajo' | 'Vida Social' | 'Proyectos Personales';

export interface Meeting {
  id: string;
  title: string;
  date: string;
  category: Category;
  summary: string;
  originalText?: string;
  audioUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}
