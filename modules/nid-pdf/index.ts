import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { Ref } from 'react';
import type { ViewProps } from 'react-native';

export type PdfMark = { id: number; quote: string; page: number; color?: string };
export type PdfRef = {
  highlightSelection(): Promise<{ quote: string; page: number } | null>;
  clearSelection(): Promise<void>;
  goToPage(page: number): Promise<void>;
  search(q: string): Promise<{ index: number; page: number; text: string }[]>;
  goToResult(index: number): Promise<void>;
  outline(): Promise<{ title: string; page: number; level: number }[]>;
};
type Ev<T> = { nativeEvent: T };
export type PdfProps = ViewProps & {
  ref?: Ref<PdfRef>;
  path: string;
  initialPage?: number;
  paper?: string;
  marks?: PdfMark[];
  onPageChanged?: (e: Ev<{ page: number; total: number }>) => void;
  onSelection?: (e: Ev<{ text: string; page: number }>) => void;
  onTapMark?: (e: Ev<{ id: number }>) => void;
  onTap?: (e: Ev<object>) => void;
  onLoad?: (e: Ev<{ ok: boolean; pages?: number }>) => void;
};

// null on builds made before this module existed
export const NidPdfView: React.ComponentType<PdfProps> | null = requireOptionalNativeModule('NidPdf') ? requireNativeView<PdfProps>('NidPdf') : null;
