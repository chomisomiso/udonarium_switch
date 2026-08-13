import { Injectable } from '@angular/core';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';

/**
 * ターゲット中のキャラクターを保持する。ローカル状態でピア間の同期はしない。
 *
 * 作りは upstream の TabletopSelectionService に倣っているが、あちらが Map なのは
 * 選択が3状態（SelectionState）を持つため。ターゲットは二値なので Set で足りる。
 *
 * ターゲットから外す条件（テーブルを降りた・削除された）はここが自分で見る。
 * コマの DOM が消えたかどうかとは無関係に保つため。
 */
@Injectable({
  providedIn: 'root'
})
export class GameCharacterTargetingService {
  private readonly targets: Set<GameCharacter> = new Set();
  private readonly previous: Set<GameCharacter> = new Set();
  private isUpdateBatching = false;

  constructor() { this.initialize(); }

  // root シングルトンで破棄されないので unregister はしない（tabletop.service.ts と同じ作法）
  private initialize() {
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => this.removeIfLeftTable(event.data.identifier))
      .on('DELETE_GAME_OBJECT', event => this.removeByIdentifier(event.data.identifier));
  }

  /**
   * テーブルを降りたキャラをターゲットから外す。
   * UPDATE_GAME_OBJECT はドラッグ中も流れる高頻度イベントなので O(1) に保つこと。
   */
  private removeIfLeftTable(identifier: string) {
    let object = ObjectStore.instance.get<GameCharacter>(identifier);
    if (object instanceof GameCharacter && !object.isVisibleOnTable) this.remove(object);
  }

  /**
   * 削除されたキャラをターゲットから外す。
   * イベントが届く時点で ObjectStore からは消えているため、identifier で走査するしかない。
   */
  private removeByIdentifier(identifier: string) {
    for (let target of this.targets) {
      if (target.identifier !== identifier) continue;
      this.remove(target);
      return;
    }
  }

  has(object: GameCharacter): boolean {
    return this.targets.has(object);
  }

  /** ターゲット中のキャラクター */
  getTargets(): ReadonlySet<GameCharacter> {
    return this.targets;
  }

  // 範囲ドラッグは pointermove ごとに全キャラへ状態を書き込むので、
  // 変化しなかったときに抜けないと通知が毎フレーム空振りで飛ぶ
  add(object: GameCharacter) {
    if (this.targets.has(object)) return;
    this.targets.add(object);
    this.updateHighlight();
  }

  remove(object: GameCharacter) {
    if (!this.targets.has(object)) return;
    this.targets.delete(object);
    this.updateHighlight([object]);
  }

  clear() {
    let removed = Array.from(this.targets);
    this.targets.clear();
    this.updateHighlight(removed);
  }

  /**
   * ハイライト更新を microtask にまとめて通知する。
   * 現在ターゲット中のものは flush 時に拾うので、渡すのは外れたものだけでよい。
   */
  private updateHighlight(removed: GameCharacter[] = []) {
    removed.forEach(object => this.previous.add(object));
    if (this.isUpdateBatching) return;
    queueMicrotask(() => {
      this.isUpdateBatching = false;
      this.targets.forEach(object => this.previous.add(object));
      let targets = Array.from(this.previous);
      this.previous.clear();
      if (0 < targets.length) EventSystem.trigger('UPDATE_TARGET', { changed: targets });
      for (let target of targets) {
        EventSystem.trigger(`UPDATE_TARGET/identifier/${target.identifier}`, { changed: targets });
      }
    });
    this.isUpdateBatching = true;
  }
}
