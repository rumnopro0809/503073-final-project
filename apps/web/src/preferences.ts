export interface Preferences { density: string; fontSize: number; theme: 'light' | 'dark'; noteColor: string; }
export const noteColors = ['#fffdf7','#f0eaff','#e8f5ee','#fff2d8','#fce9ef','#e8f1ff'];
export function normalizePreferences(stored: Partial<Preferences> = {}): Preferences {
  return { density:stored.density === 'compact' ? 'compact':'comfortable', fontSize:[14,16,18].includes(stored.fontSize ?? 0) ? stored.fontSize! : 14,
    theme:stored.theme === 'dark' ? 'dark':'light', noteColor:noteColors.includes(stored.noteColor ?? '') ? stored.noteColor!:'#fffdf7' };
}
