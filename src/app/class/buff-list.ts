import { Buff } from './buff';
import { SyncObject } from './core/synchronize-object/decorator';
import { ObjectNode } from './core/synchronize-object/object-node';

/** バフ効果の適用先 */
export interface BuffResourceOwner {
  getCurrentDataValue(name: string): number;
  setCurrentDataValue(name: string, value: number): boolean;
}

/**
 * コマが持つバフの入れ物。`GameCharacter` の直下に 1 つだけぶら下がる。
 * バフの増減はリソースの現在値を直接動かすので、追加・削除・編集は必ずこのクラスを通すこと
 */
@SyncObject('buff-list')
export class BuffList extends ObjectNode {
  get buffs(): Buff[] {
    return this.children.filter((child): child is Buff => child instanceof Buff);
  }

  private get owner(): BuffResourceOwner | null {
    let parent = this.parent as unknown as BuffResourceOwner;
    return parent && typeof parent.setCurrentDataValue === 'function' ? parent : null;
  }

  add(name: string, rounds: number | null, effect: string): Buff {
    let buff = this.appendChild(Buff.create(name, rounds, effect));
    this.applyEffect(effect, 1);

    return buff;
  }

  remove(buff: Buff): boolean {
    if (!buff || !this.removeChild(buff)) return false;
    this.applyEffect(buff.effect, -1);

    return true;
  }

  /** 名前の一致するバフを**すべて**外す。チャットの `&名前-` は名前しか運べない。 */
  removeByName(name: string): Buff[] {
    return this.removeWhere(buff => buff.buffName === name);
  }

  /** バフの名前・残りラウンド・効果を書き換える。リソースは旧効果を戻してから新効果を入れ直す。 */
  edit(buff: Buff, name: string, rounds: number | null, effect: string): boolean {
    if (!buff || buff.parent !== this) return false;

    let oldEffect = buff.effect;
    buff.buffName = name;
    buff.rounds = rounds;
    buff.effect = effect;

    this.applyEffect(oldEffect, -1);
    this.applyEffect(effect, 1);
    return true;
  }

  removeExpired(): Buff[] {
    return this.removeWhere(buff => buff.isExpired);
  }

  private removeWhere(predicate: (buff: Buff) => boolean): Buff[] {
    let removed: Buff[] = [];
    for (let buff of this.buffs) {
      if (predicate(buff) && this.remove(buff)) removed.push(buff);
    }
    return removed;
  }

  /** 無制限のバフは動かさない。0R より下へは減らない */
  changeAllRounds(delta: number): void {
    for (let buff of this.buffs) {
      if (buff.isInfinite) continue;
      buff.rounds = buff.rounds + delta;
    }
  }

  /** 効果に書かれたリソース増減を反映する。sign が -1 ならバフ解除 */
  private applyEffect(effect: string, sign: 1 | -1): void {
    let owner = this.owner;
    if (!owner) return;

    for (let term of Buff.parseEffectTerms(effect)) {
      owner.setCurrentDataValue(term.name, Number(owner.getCurrentDataValue(term.name)) + term.delta * sign);
    }
  }
}
