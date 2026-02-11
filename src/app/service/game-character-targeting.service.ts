import { Injectable } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';

@Injectable({
  providedIn: 'root'
})
export class GameCharacterTargetingService {
  private readonly targetingMap: Map<GameCharacter, boolean> = new Map();
  private readonly previous: Set<GameCharacter> = new Set();
  private isUpdateBatching = false;

  get size(): number { return this.targetingMap.size; }
  get objects(): GameCharacter[] { return Array.from(this.targetingMap.keys()); }

  constructor() { }

  getState(object: GameCharacter): boolean {
    return this.targetingMap.get(object) ?? false;
  }

  add(object: GameCharacter, state: boolean = true) {
    if (!state) return this.remove(object);
    let prevs = this.objects;
    this.targetingMap.set(object, state);
    this.updateHighlight(prevs);
  }

  remove(object: GameCharacter) {
    if (!this.targetingMap.has(object)) return;
    let prevs = this.objects;
    this.targetingMap.delete(object);
    this.updateHighlight(prevs);
  }

  toggle(object: GameCharacter) {
    this.getState(object) ? this.remove(object) : this.add(object);
  }

  clear() {
    let prevs = this.objects;
    this.targetingMap.clear();
    this.updateHighlight(prevs);
  }

  getTargets() {
    let targets: Set<GameCharacter> = new Set();
    this.targetingMap.forEach((value, key) => {
      if (value) targets.add(key);
    });
    return targets;
  }

  private updateHighlight(prevs: GameCharacter[] = []) {
    prevs.forEach(prev => this.previous.add(prev));
    if (this.isUpdateBatching) return;
    queueMicrotask(() => {
      this.isUpdateBatching = false;
      this.targetingMap.forEach((state, object) => this.previous.add(object));
      let targets = Array.from(this.previous);
      this.previous.clear();
      console.log('UPDATE_TARGET');
      if (0 < targets.length) EventSystem.trigger('UPDATE_TARGET', { changed: targets });
      for (let target of targets) {
        EventSystem.trigger(`UPDATE_TARGET/identifier/${target.identifier}`, { changed: targets });
      }
    });
    this.isUpdateBatching = true;
  }
}
