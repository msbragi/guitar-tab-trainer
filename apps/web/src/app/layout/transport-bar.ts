import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../shared/icon.js';

@Component({
  selector: 'gp-transport-bar', imports: [TranslocoPipe, Icon],
  template: `
    <footer class="transport-bar" [attr.aria-label]="'transport.title' | transloco">
      <p id="playback-unavailable" class="transport-notice"><span class="status-dot"></span>{{ 'transport.unavailable' | transloco }}</p>
      <fieldset disabled aria-describedby="playback-unavailable">
        <legend class="visually-hidden">{{ 'transport.title' | transloco }}</legend>
        <div class="transport-buttons">
          <button class="round-button" type="button" [attr.aria-label]="'transport.previous' | transloco"><gp-icon name="previous" /></button>
          <button class="round-button play-button" type="button" [attr.aria-label]="'transport.play' | transloco"><gp-icon name="play" /></button>
          <button class="round-button" type="button" [attr.aria-label]="'transport.stop' | transloco"><gp-icon name="stop" /></button>
        </div>
        <div class="timeline"><span aria-hidden="true">— / —</span><input type="range" min="0" max="1" value="0" [attr.aria-label]="'transport.timeline' | transloco"></div>
        <div class="loop-controls"><button class="control-button" type="button" [attr.aria-label]="'transport.loop' | transloco"><gp-icon name="loop" /></button>
          <button class="control-button" type="button" [attr.aria-label]="'transport.loopA' | transloco">A</button>
          <button class="control-button" type="button" [attr.aria-label]="'transport.loopB' | transloco">B</button></div>
        <label class="transport-field">{{ 'transport.speed' | transloco }}<select><option>100%</option></select></label>
        <label class="transport-field">{{ 'transport.tempo' | transloco }}<input type="text" value="—" size="3"></label>
        <label class="transport-volume"><gp-icon name="volume" /><span class="visually-hidden">{{ 'transport.volume' | transloco }}</span><input type="range" min="0" max="100" value="100"></label>
      </fieldset>
    </footer>`,
})
export class TransportBar {}
