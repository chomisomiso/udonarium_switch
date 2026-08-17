import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { ObjectNode } from './core/synchronize-object/object-node';
import { MathUtil } from './core/system/util/math-util';

/** 効果の 1 項。`HP+30` → `{ name: 'HP', delta: 30 }` */
export interface BuffEffectTerm {
  name: string;
  delta: number;
}

const EFFECT_TERM_PATTERN = /([^,+\-=>:]+)([-+=>])(\d+)/g;

/** バフ。BuffList の下にだけ置かれる。 */
@SyncObject('buff')
export class Buff extends ObjectNode {
  @SyncVar() buffName: string = ''; // nameだとgetAttribute('name')で誤爆する
  @SyncVar() effect: string = '';

  /** 残りラウンドの生値 無制限は'' */
  @SyncVar() protected roundsValue: string = '';

  /** 残りラウンド 無制限はnull */
  get rounds(): number | null {
    return this.roundsValue === '' ? null : Number(this.roundsValue);
  }
  set rounds(rounds: number | null) {
    this.roundsValue = rounds == null || Number.isNaN(rounds) ? '' : String(MathUtil.clampMin(rounds));
  }

  get isInfinite(): boolean { return this.rounds == null; }

  get isExpired(): boolean {
    let rounds = this.rounds;
    return rounds != null && rounds <= 0;
  }

  /** バッジ用の残ラウンド表記 */
  get roundLabel(): string { return this.isInfinite ? '∞' : `${this.rounds}R`; }

  /** 文章に混ぜるときの残ラウンド表記 */
  get roundText(): string { return this.isInfinite ? '無制限' : `${this.rounds}R`; }

  /** ラウンドを 1 段動かしたときの次の値。ホイール操作の行き先を決める。 */
  static stepRounds(rounds: number | null, step: number): number | null {
    let next = (rounds ?? 0) + step;
    return next < 0 ? null : next;
  }

  static create(name: string, rounds: number | null, effect: string): Buff {
    let buff = new Buff();
    buff.buffName = name;
    buff.effect = effect;
    buff.rounds = rounds;
    buff.initialize();

    return buff;
  }

  /** 効果に書かれたリソース増減を項ごとに読む。元の値に戻せないので代入は解釈しない。 */
  static parseEffectTerms(effect: string): BuffEffectTerm[] {
    let terms: BuffEffectTerm[] = [];
    if (effect == null) return terms;

    for (let [, name, operator, value] of effect.matchAll(EFFECT_TERM_PATTERN)) {
      if (operator !== '+' && operator !== '-') continue;
      terms.push({ name: name, delta: Number(value) * (operator === '+' ? 1 : -1) });
    }
    return terms;
  }
}
