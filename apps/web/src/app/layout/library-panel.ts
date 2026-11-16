import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../shared/icon.js';

@Component({
  selector: 'gp-library-panel', imports: [TranslocoPipe, Icon],
  template: `
    <aside class="side-panel library-panel" [class.collapsed]="collapsed()" [attr.aria-label]="'shell.libraryPanel' | transloco">
      <div class="panel-top"><span class="panel-caption">{{ 'nav.library' | transloco }}</span>
        <button class="icon-button" type="button" [attr.aria-label]="(collapsed() ? 'shell.expandLibrary' : 'shell.collapseLibrary') | transloco"
          [attr.aria-expanded]="!collapsed()" aria-controls="library-panel-content" (click)="toggle.emit()"><gp-icon [name]="collapsed() ? 'right' : 'left'" /></button></div>
      <button class="primary-button open-tab" type="button" [disabled]="busy()" [attr.aria-label]="'shell.openTab' | transloco" (click)="openTab.emit()">
        <gp-icon name="folder" /><span>{{ 'shell.openTab' | transloco }}</span></button>
      <div id="library-panel-content" [hidden]="collapsed()">
        <section class="library-section"><h3><gp-icon name="clock" />{{ 'shell.recent' | transloco }}</h3>
          <p class="empty-panel">{{ 'shell.recentUnavailable' | transloco }}</p></section>
        <section class="library-section"><h3><gp-icon name="star" />{{ 'shell.favorites' | transloco }}</h3>
          <p class="empty-panel">{{ 'shell.favoritesUnavailable' | transloco }}</p></section>
        <div class="local-note"><span class="status-dot"></span>{{ 'footer.local' | transloco }}<p>{{ 'file.hint' | transloco }}</p></div>
      </div>
    </aside>`,
})
export class LibraryPanel {
  readonly collapsed = input(false);
  readonly busy = input(false);
  readonly toggle = output<void>();
  readonly openTab = output<void>();
}
