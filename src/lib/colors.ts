import { useColorScheme } from 'react-native';

export function luminance(hex: string) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

export const inkOn = (hex: string) => (luminance(hex) > 0.62 ? '#111111' : '#FFFFFF');

export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    bg: dark ? '#000000' : '#F2F2F7',
    card: dark ? '#1C1C1E' : '#FFFFFF',
    ink: dark ? '#FFFFFF' : '#000000',
    ink2: dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)',
    line: dark ? 'rgba(84,84,88,0.6)' : 'rgba(60,60,67,0.18)',
    fill: dark ? 'rgba(118,118,128,0.24)' : 'rgba(118,118,128,0.12)',
    hisFill: dark ? 'rgba(58,58,60,0.72)' : 'rgba(233,233,235,0.78)',
    hisInk: dark ? '#FFFFFF' : '#000000',
    meta: dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)',
    blue: '#0A84FF',
  };
}
