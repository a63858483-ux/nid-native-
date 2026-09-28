import { requireOptionalNativeModule } from 'expo';

export type TextEffectEvent = { kind: string; start: number; end: number };
type TextMenuModule = {
  addListener(event: 'onTextEffect', listener: (e: TextEffectEvent) => void): { remove(): void };
};

// null on dev builds made before this module existed
export const TextMenu = requireOptionalNativeModule<TextMenuModule>('NidTextMenu');
