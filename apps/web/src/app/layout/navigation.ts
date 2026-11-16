import type { IconName } from '../shared/icon.js';
export type Section = 'practice' | 'library' | 'projects' | 'rig' | 'settings';
export const sections: readonly { id: Section; icon: IconName }[] = [
  { id: 'practice', icon: 'play' }, { id: 'library', icon: 'folder' },
  { id: 'projects', icon: 'layers' }, { id: 'rig', icon: 'rig' },
  { id: 'settings', icon: 'settings' },
];
