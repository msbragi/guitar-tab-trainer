import { Component, input } from '@angular/core';

const paths = {
  guitar: 'M19 2l3 3-9 9m3-11 5 5M9 10c-3-3-9 2-6 6-2 3 0 6 3 5 4 2 9-4 6-7M6 17l2 2M9 15l1 1',
  play: 'M8 4l13 8-13 8z',
  pause: 'M8 5v14M16 5v14',
  folder: 'M3 6h7l2 3h9v11H3zM3 6V4h6l2 2',
  layers: 'M12 3L2 8l10 5 10-5zM2 12l10 5 10-5M2 16l10 5 10-5',
  rig: 'M4 5h16v15H4zM7 2v3m10-3v3M4 9h16M8 13v4m4-4v4m4-4v4',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8M9 3h6l1 3 3 1 2 5-2 3-3 1-1 5H9l-1-3-3-1-2-5 2-3 3-1z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18M12 7v6l4 2',
  star: 'M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
  tracks: 'M5 3v5m0 6v7M2 8h6v6H2zM12 3v10m0 5v3M9 13h6v5H9zM19 3v3m0 6v9M16 6h6v6h-6z',
  expand: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
  collapse: 'M3 9h6V3m6 0v6h6M9 21v-6H3m12 6v-6h6',
  music: 'M10 18V5l10-2v13M10 8l10-2M10 18a3 2 0 11-6 0 3 2 0 016 0m10-2a3 2 0 11-6 0 3 2 0 016 0',
  previous: 'M5 5v14M19 5l-11 7 11 7z',
  stop: 'M6 6h12v12H6z',
  loop: 'M4 8h14l-3-3m3 3-3 3M20 16H6l3-3m-3 3 3 3',
  volume: 'M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 010 8m3-11a10 10 0 010 14',
} as const;
export type IconName = keyof typeof paths;

@Component({
  selector: 'gp-icon',
  host: { 'aria-hidden': 'true' },
  template: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path [attr.d]="paths[name()]"/></svg>',
  styles: ':host{display:inline-flex;width:1.25em;height:1.25em;flex-shrink:0}svg{width:100%;height:100%}',
})
export class Icon {
  readonly name = input<IconName>('music');
  readonly paths = paths;
}
