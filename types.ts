
export interface TranscriptItem {
  id: string;
  speaker: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface AudioVolumeState {
  userVolume: number; // 0 to 1
  modelVolume: number; // 0 to 1
}