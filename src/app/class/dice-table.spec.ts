import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DiceTable } from '@udonarium/dice-table';
import { resetGameObjects } from 'testing/game-object-testing';

describe('DiceTable', () => {
  afterEach(resetGameObjects);

  /** ObjectStore を汚さずに表本体だけを検証するための素の DiceTable */
  function makeTable(text: string): DiceTable {
    let diceTable = new DiceTable();
    diceTable.text = text;
    return diceTable;
  }

  describe('lookup - 行の書式', () => {
    it('単一の出目', () => {
      let table = makeTable('2:凶\n3:末吉');

      expect(table.lookup(2)).toBe('凶');
      expect(table.lookup(3)).toBe('末吉');
    });

    it('範囲指定', () => {
      let table = makeTable('4-6:小吉');

      expect(table.lookup(4)).toBe('小吉');
      expect(table.lookup(5)).toBe('小吉');
      expect(table.lookup(6)).toBe('小吉');
      expect(table.lookup(3)).toBeNull();
      expect(table.lookup(7)).toBeNull();
    });

    it('下限を省略すると上限だけの範囲になる', () => {
      let table = makeTable('-9:中吉');

      expect(table.lookup(9)).toBe('中吉');
      expect(table.lookup(-100)).toBe('中吉');
      expect(table.lookup(10)).toBeNull();
    });

    it('上限を省略すると下限だけの範囲になる', () => {
      let table = makeTable('13~:大吉');

      expect(table.lookup(13)).toBe('大吉');
      expect(table.lookup(9999)).toBe('大吉');
      expect(table.lookup(12)).toBeNull();
    });

    it('範囲が逆順でも正規化される', () => {
      let table = makeTable('6-4:小吉');

      expect(table.lookup(5)).toBe('小吉');
      expect(table.lookup(4)).toBe('小吉');
      expect(table.lookup(6)).toBe('小吉');
    });

    it('該当する行が無ければ null', () => {
      expect(makeTable('2:凶').lookup(5)).toBeNull();
      expect(makeTable('').lookup(5)).toBeNull();
    });
  });

  describe('lookup - 区切り文字のゆれ', () => {
    it('半角コロン以外の区切りを受け付ける', () => {
      expect(makeTable('2：凶').lookup(2)).toBe('凶');
      expect(makeTable('2,凶').lookup(2)).toBe('凶');
      expect(makeTable('2，凶').lookup(2)).toBe('凶');
      expect(makeTable('2 凶').lookup(2)).toBe('凶');
    });

    it('全角の数字・記号を半角として解釈する', () => {
      expect(makeTable('４－６：小吉').lookup(5)).toBe('小吉');
      expect(makeTable('１３～：大吉').lookup(20)).toBe('大吉');
    });

    // toHalfWidth は U+FF01〜U+FF5E しか変換しないため、
    // 長音符やダッシュ類は範囲パターン側で個別に許容している
    it('半角化されないダッシュ類も範囲の区切りとして扱う', () => {
      expect(makeTable('4ー6:小吉').lookup(5)).toBe('小吉');   // U+30FC 長音符
      expect(makeTable('4〜6:小吉').lookup(5)).toBe('小吉');   // U+301C 波ダッシュ
      expect(makeTable('4−6:小吉').lookup(5)).toBe('小吉');   // U+2212 マイナス
    });

    it('区切りの後の余分な空白を無視する', () => {
      expect(makeTable('2:   凶').lookup(2)).toBe('凶');
      expect(makeTable('   2:凶').lookup(2)).toBe('凶');
    });
  });

  describe('lookup - 表として扱わない行', () => {
    it('数字を含まない行は読み飛ばす', () => {
      let table = makeTable('見出し:これは表の行ではない\n2:凶');

      expect(table.lookup(2)).toBe('凶');
    });

    it('区切り記号だけの行は読み飛ばす', () => {
      let table = makeTable('-:区切り線のつもり\n2:凶');

      expect(table.lookup(2)).toBe('凶');
    });

    it('区切り文字が無い行と空行は読み飛ばす', () => {
      let table = makeTable('ただのコメント行\n\n2:凶');

      expect(table.lookup(2)).toBe('凶');
    });
  });

  describe('lookup - 本文', () => {
    it('\\n を実際の改行に展開する', () => {
      expect(makeTable('2:一行目\\n二行目').lookup(2)).toBe('一行目\n二行目');
    });

    it('本文の区切り文字はそのまま残す', () => {
      expect(makeTable('2:凶:さらに凶').lookup(2)).toBe('凶:さらに凶');
    });

    it('本文が空でも行として成立する', () => {
      expect(makeTable('2:').lookup(2)).toBe('');
    });
  });

  // 範囲が重なったときは先に書いた行が勝つ。createSample() の表はこの性質に依存していて、
  // '-9:中吉' は '4-6' より後ろにあるので 2d6 の実運用では 7〜9 として機能する
  describe('lookup - 先に書いた行が優先される', () => {
    it('重複する範囲では先頭の行を返す', () => {
      let table = makeTable('4-6:さきに書いた\n5:あとに書いた');

      expect(table.lookup(5)).toBe('さきに書いた');
    });

    it('createSample の表が想定どおりに引ける', () => {
      let table = DiceTable.createSample();

      expect(table.lookup(2)).toBe('凶');
      expect(table.lookup(3)).toBe('末吉');
      expect(table.lookup(5)).toBe('小吉');
      expect(table.lookup(7)).toBe('中吉');    // 4-6 に外れたので -9 が拾う
      expect(table.lookup(9)).toBe('中吉');
      expect(table.lookup(10)).toBe('吉');     // -9 に外れたので ~12 が拾う
      expect(table.lookup(12)).toBe('吉');
      expect(table.lookup(13)).toBe('大吉');
    });
  });

  describe('ファクトリ', () => {
    it('create() は空の表を ObjectStore に登録する', () => {
      let table = DiceTable.create();

      expect(table.name).toBe('新しいダイス表');
      expect(table.text).toBe('');
      expect(table.dice).toBe('2d6');
      expect(table.dicebot).toBe('DiceBot');
      expect(ObjectStore.instance.get(table.identifier)).toBe(table);
    });

    it('createSample() は固定の identifier を使う', () => {
      let table = DiceTable.createSample();

      expect(table.identifier).toBe('SampleDiceTable');
      expect(table.command).toBe('SAMPLE');
      expect(ObjectStore.instance.get('SampleDiceTable')).toBe(table);
    });
  });
});
