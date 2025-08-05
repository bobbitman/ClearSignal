export interface TranscriptionSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptionResult {
  id: string;
  language: string;
  segments: TranscriptionSegment[];
  fullText: string;
  processingTime: number;
}

export interface Config {
  maxFileSize: number;
  maxDuration: number;
  supportedExtensions: string[];
  assemblyAIKey: string;
}

export interface ApiError {
  detail: string;
}