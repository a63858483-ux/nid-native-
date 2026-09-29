import { requireOptionalNativeModule } from 'expo';

export type NowItem = { id: string; title: string; artist?: string; album?: string; artwork?: string; color?: string; songId?: string; duration?: number };
export type NowState = { playing: boolean; time: number; item?: NowItem };
type NidMusicModule = {
  authorize(): Promise<'authorized' | 'denied' | 'restricted' | 'notDetermined' | 'unknown'>;
  authorizationStatus(): string;
  api(path: string): Promise<string>;
  request?(method: string, path: string, body: string): Promise<string>;
  play(kind: 'songs' | 'playlist' | 'album', ids: string[], library: boolean, start: number): Promise<void>;
  resume(): Promise<void>;
  pause(): void;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(seconds: number): void;
  state(): NowState;
  addListener(event: 'onChange', listener: (s: NowState) => void): { remove(): void };
};

// null on builds made before this module existed
export const NidMusic = requireOptionalNativeModule<NidMusicModule>('NidMusic');
