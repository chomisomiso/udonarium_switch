import { Injectable } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';

export enum TargetState {
  NONE,
  TARGETED,
}

@Injectable({
  providedIn: 'root'
})
export class GameCharacterTargetingService {
  private readonly targetingMap: Map<GameCharacter, TargetState> = new Map();
  private readonly previus: Set<GameCharacter> = new Set();

  get size(): number { return this.targetingMap.size; }
  get objects(): GameCharacter[] { return Array.from(this.targetingMap.keys()); }

  constructor() { }

  state(object: GameCharacter): TargetState {
    return this.targetingMap.get(object) ?? TargetState.NONE;
  }

  add(object: GameCharacter, state: TargetState = TargetState.TARGETED) {
    if (state === TargetState.NONE) return this.remove(object);
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

  clear() {
    let prevs = this.objects;
    this.targetingMap.clear();
    this.updateHighlight(prevs);
  }

  getTargets() {
    let targets: Set<GameCharacter> = new Set();
    this.targetingMap.forEach((value, key) => {
      if (value === TargetState.TARGETED) targets.add(key);
    });
    return targets;
  }

  private updateHighlight(prevs: GameCharacter[] = []) {
    prevs.forEach(prev => this.previus.add(prev));
    queueMicrotask(() => {
      this.targetingMap.forEach((state, object) => this.previus.add(object));
      let targets = Array.from(this.previus);
      this.previus.clear();
      if (0 < targets.length) EventSystem.trigger('UPDATE_TARGET', { changed: targets });
      for (let target of targets) {
        EventSystem.trigger(`UPDATE_TARGET/identifier/${target.identifier}`, { changed: targets });
      }
    });
  }
}
