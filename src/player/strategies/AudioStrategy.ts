// src/player/strategies/AudioStrategy.ts - Interface básica para estratégias de áudio

import type { Track } from '../state';

export interface TrackCue {
  startTime: number;
  endTime: number;
  title: string;
  artist: string;
  filename: string;
}

export interface AudioStrategyEvents {
  onTrackChange?: (track: TrackCue) => void; // Usar TrackCue em vez de Track
  onTimeUpdate?: (currentTime: number, duration?: number) => void; // Aceitar duration opcional
  onLoadedMetadata?: () => void;
  onCanPlay?: () => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onLoadStart?: () => void;
  onStalled?: () => void;
}

// Interface mínima para compatibilidade - IOSPWAStrategy não implementa totalmente
export interface AudioStrategy {
  // Propriedade opcional para satisfazer o TypeScript
  _placeholder?: never;
}

// Re-export do Track
export type { Track };
