import { Buff } from '@udonarium/buff';
import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';
import { resetGameObjects } from 'testing/game-object-testing';

describe('Buff', () => {
  afterEach(resetGameObjects);

  /** XML から復元する。属性の生値が setter を通らずに入る経路 */
  function parseBuff(xml: string): Buff {
    return ObjectSerializer.instance.parseXml(xml) as Buff;
  }

  describe('rounds', () => {
    it('数値をそのまま保つ', () => {
      expect(Buff.create('加護', 3, 'HP+30').rounds).toBe(3);
    });

    it('null は無制限', () => {
      let buff = Buff.create('祝福', null, 'MP+10');

      expect(buff.rounds).toBeNull();
      expect(buff.isInfinite).toBe(true);
    });

    // 0R で期限切れは表現できるので、それより下に意味が無い
    it('負数は 0 に丸める', () => {
      let buff = Buff.create('毒', 3, 'HP-5');
      buff.rounds = -3;

      expect(buff.rounds).toBe(0);
    });

    // コマンド文法側の BuffAddOptions.round と揃える
    it('NaN は無制限として扱う', () => {
      expect(Buff.create('加護', NaN, 'HP+30').rounds).toBeNull();
    });

    it('XML から来た文字列を数値として読む', () => {
      let buff = Buff.create('加護', 3, 'HP+30').clone();

      expect(buff.rounds).toBe(3);
      expect(buff.buffName).toBe('加護');
      expect(buff.effect).toBe('HP+30');
    });

    it('無制限は XML を往復しても無制限のまま', () => {
      expect(Buff.create('祝福', null, 'MP+10').clone().rounds).toBeNull();
    });
  });

  describe('stepRounds', () => {
    it('残ラウンドを増減する', () => {
      expect(Buff.stepRounds(3, -1)).toBe(2);
      expect(Buff.stepRounds(3, 1)).toBe(4);
    });

    it('無制限からは 0 起点で動かす', () => {
      expect(Buff.stepRounds(null, 1)).toBe(1);
      expect(Buff.stepRounds(null, -1)).toBeNull();
    });

    // 負数を取らない以上、0 より下の行き先はここしかない
    it('0 より下へ回すと無制限へ戻る', () => {
      expect(Buff.stepRounds(0, -1)).toBeNull();
    });
  });

  describe('isExpired', () => {
    it('0R は期限切れ', () => {
      expect(Buff.create('毒', 0, 'HP-5').isExpired).toBe(true);
    });

    it('残ラウンドがあれば期限切れではない', () => {
      expect(Buff.create('加護', 1, 'HP+30').isExpired).toBe(false);
    });

    it('無制限は期限切れにならない', () => {
      expect(Buff.create('祝福', null, 'MP+10').isExpired).toBe(false);
    });

    // rounds の setter を通らない経路（手書きや他実装の XML）でも期限切れとして扱う
    it('setter を通らない負数の生値も期限切れとして扱う', () => {
      expect(parseBuff('<buff buffName="呪い" roundsValue="-3" effect=""/>').isExpired).toBe(true);
    });
  });

  // 表記が画面ごとに割れないよう、ラベルの生成はクラスに集める
  describe('roundLabel / roundText', () => {
    it('残ラウンドがあれば R を付ける', () => {
      let buff = Buff.create('加護', 3, 'HP+30');

      expect(buff.roundLabel).toBe('3R');
      expect(buff.roundText).toBe('3R');
    });

    it('0R も R を付ける', () => {
      let buff = Buff.create('毒', 0, 'HP-5');

      expect(buff.roundLabel).toBe('0R');
      expect(buff.roundText).toBe('0R');
    });

    it('無制限はバッジが ∞、文章が 無制限', () => {
      let buff = Buff.create('祝福', null, 'MP+10');

      expect(buff.roundLabel).toBe('∞');
      expect(buff.roundText).toBe('無制限');
    });
  });

  describe('parseEffectTerms', () => {
    it('増減を項として読む', () => {
      expect(Buff.parseEffectTerms('HP+30')).toEqual([{ name: 'HP', delta: 30 }]);
    });

    it('`,` 区切りで複数の項を読む', () => {
      expect(Buff.parseEffectTerms('HP+10,MP-3')).toEqual([
        { name: 'HP', delta: 10 },
        { name: 'MP', delta: -3 },
      ]);
    });

    // 代入は外すときに戻せず、編集で辻褄が合わなくなるので解釈しない
    it('`=` `>` による代入は落とす', () => {
      expect(Buff.parseEffectTerms('HP=10')).toEqual([]);
      expect(Buff.parseEffectTerms('MP>50')).toEqual([]);
    });

    // 代入を読み飛ばす正規表現にすると、途中で再同期して隣の項を巻き込んで落としていた
    it('区切り無しで代入と増減が並んでも増減だけ拾う', () => {
      expect(Buff.parseEffectTerms('HP=10MP+5')).toEqual([{ name: 'MP', delta: 5 }]);
    });

    it('区切り無しで増減が並んでも両方拾う', () => {
      expect(Buff.parseEffectTerms('HP+10MP-3')).toEqual([
        { name: 'HP', delta: 10 },
        { name: 'MP', delta: -3 },
      ]);
    });

    it('リソース指定を含まない効果は項を持たない', () => {
      expect(Buff.parseEffectTerms('命中判定に有利')).toEqual([]);
    });

    it('空の効果は項を持たない', () => {
      expect(Buff.parseEffectTerms('')).toEqual([]);
    });
  });
});
