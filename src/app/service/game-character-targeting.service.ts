import { Injectable } from '@angular/core';
import { CharacterPart } from '@udonarium/character-part/character-part';
import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';

/** コマ単位で見たターゲット状態。多部位コマは部位ごとに割れうる */
export type CharacterTargetState = 'none' | 'partial' | 'all';

/**
 * ターゲット中の操作単位（単部位コマ・部位）を保持する。ローカル状態でピア間の同期はしない。
 *
 * 作りは upstream の TabletopSelectionService に倣っているが、あちらが Map なのは
 * 選択が3状態（SelectionState）を持つため。ターゲットは二値なので Set で足りる。
 *
 * ターゲットから外す条件（テーブルを降りた・削除された）はここが自分で見る。
 * コマの DOM が消えたかどうかとは無関係に保つため。
 *
 * 多部位コマは部位をターゲットする。コマから操作するときは toggleCharacter / setCharacterTargeted で一括に扱う。
 */
@Injectable({
  providedIn: 'root'
})
export class GameCharacterTargetingService {
  private readonly targets: Set<CharacterUnit> = new Set();
  private readonly previous: Set<CharacterUnit> = new Set();
  private isUpdateBatching = false;

  constructor() { this.initialize(); }

  // root シングルトンで破棄されないので unregister はしない（tabletop.service.ts と同じ作法）
  private initialize() {
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => this.removeIfLeftTable(event.data.identifier))
      .on(`UPDATE_GAME_OBJECT/aliasName/${CharacterPart.aliasName}`, event => this.removeMultiPartCharacter(event.data.identifier))
      .on('DELETE_GAME_OBJECT', event => this.removeByIdentifier(event.data.identifier));
  }

  /**
   * テーブルを降りたキャラをターゲットから外す。部位も一緒に外す。
   * UPDATE_GAME_OBJECT はドラッグ中も流れる高頻度イベントなので、部位の走査はテーブルを降りたときだけにする。
   */
  private removeIfLeftTable(identifier: string) {
    let object = ObjectStore.instance.get<GameCharacter>(identifier);
    if (!(object instanceof GameCharacter) || object.isVisibleOnTable) return;
    this.remove(object);
    object.parts.forEach(part => this.remove(part));
  }

  /** 部位が足されて多部位になったコマは、コマ本体としてはターゲットにならない */
  private removeMultiPartCharacter(identifier: string) {
    let part = ObjectStore.instance.get<CharacterPart>(identifier);
    let character = part instanceof CharacterPart ? CharacterUnit.characterOf(part) : null;
    if (character) this.remove(character);
  }

  /**
   * 削除されたキャラ・部位をターゲットから外す。
   * イベントが届く時点で ObjectStore からは消えているため、identifier で走査するしかない。
   */
  private removeByIdentifier(identifier: string) {
    for (let target of this.targets) {
      if (target.identifier !== identifier) continue;
      this.remove(target);
      return;
    }
  }

  has(unit: CharacterUnit): boolean {
    return this.targets.has(unit);
  }

  /** ターゲット中の操作単位 */
  getTargets(): ReadonlySet<CharacterUnit> {
    return this.targets;
  }

  /** コマ単位で見た状態 */
  stateOf(character: GameCharacter): CharacterTargetState {
    let units = CharacterUnit.unitsOf(character);
    let count = units.filter(unit => this.targets.has(unit)).length;
    if (count < 1) return 'none';
    return count < units.length ? 'partial' : 'all';
  }

  /** コマからの一括切り替え。部位で状態が割れているときは全部外す */
  toggleCharacter(character: GameCharacter) {
    this.setCharacterTargeted(character, this.stateOf(character) === 'none');
  }

  /** コマの全操作単位を同じ状態にそろえる */
  setCharacterTargeted(character: GameCharacter, targeted: boolean) {
    for (let unit of CharacterUnit.unitsOf(character)) {
      if (targeted) this.add(unit);
      else this.remove(unit);
    }
  }

  // 範囲ドラッグは pointermove ごとに全キャラへ状態を書き込むので、
  // 変化しなかったときに抜けないと通知が毎フレーム空振りで飛ぶ
  add(unit: CharacterUnit) {
    if (this.targets.has(unit)) return;
    this.targets.add(unit);
    this.updateHighlight();
  }

  remove(unit: CharacterUnit) {
    if (!this.targets.has(unit)) return;
    this.targets.delete(unit);
    this.updateHighlight([unit]);
  }

  clear() {
    let removed = Array.from(this.targets);
    this.targets.clear();
    this.updateHighlight(removed);
  }

  /**
   * ハイライト更新を microtask にまとめて通知する。
   * 現在ターゲット中のものは flush 時に拾うので、渡すのは外れたものだけでよい。
   * コマはコマの identifier で購読しているので、部位の変化は持ち主の identifier でも知らせる
   */
  private updateHighlight(removed: CharacterUnit[] = []) {
    removed.forEach(object => this.previous.add(object));
    if (this.isUpdateBatching) return;
    queueMicrotask(() => {
      this.isUpdateBatching = false;
      this.targets.forEach(object => this.previous.add(object));
      let targets = Array.from(this.previous);
      this.previous.clear();
      if (0 < targets.length) EventSystem.trigger('UPDATE_TARGET', { changed: targets });

      let identifiers = new Set<string>();
      for (let target of targets) {
        identifiers.add(target.identifier);
        let character = CharacterUnit.characterOf(target);
        if (character) identifiers.add(character.identifier);
      }
      for (let identifier of identifiers) {
        EventSystem.trigger(`UPDATE_TARGET/identifier/${identifier}`, { changed: targets });
      }
    });
    this.isUpdateBatching = true;
  }
}
