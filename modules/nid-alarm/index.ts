import { requireOptionalNativeModule } from 'expo';

type NidAlarmModule = {
  authorize(): Promise<'authorized' | 'denied' | 'unknown'>;
  schedule(id: string, epochMs: number, title: string): Promise<string>;
  cancel(id: string): Promise<void>;
  list(): Promise<{ id: string; state: string; at?: number }[]>;
};

// null on builds made before this module existed
export const NidAlarm = requireOptionalNativeModule<NidAlarmModule>('NidAlarm');
