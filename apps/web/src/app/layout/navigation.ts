import type { IconName } from '../shared/icon/icon.js';
export type Section = 'practice' | 'settings';
export const sections: readonly { id: Section; icon: IconName }[] = [
  { id: 'practice', icon: 'play' },
  { id: 'settings', icon: 'settings' },
];
