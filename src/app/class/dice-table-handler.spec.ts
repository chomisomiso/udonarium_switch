import { DiceRollResult } from '@udonarium/dice-bot';
import { DiceTable } from '@udonarium/dice-table';
import { DiceTableHandler } from '@udonarium/dice-table-handler';
import { resetGameObjects } from 'testing/game-object-testing';

describe('DiceTableHandler', () => {
  let handler: DiceTableHandler;

  beforeEach(() => {
    handler = new DiceTableHandler();
  });

  afterEach(resetGameObjects);

  /** ObjectStore に登録された DiceTable を作る（matchDiceTable は ObjectStore を引くため） */
  function registerTable(command: string, text: string = '2:結果'): DiceTable {
    let diceTable = new DiceTable();
    diceTable.command = command;
    diceTable.text = text;
    diceTable.initialize();
    return diceTable;
  }

  function matchDiceTable(text: string) {
    return (handler as any).matchDiceTable(text);
  }

  function parseModifier(text: string): string | null {
    return (handler as any).parseModifier(text);
  }

  function extractTotal(resultText: string): number | null {
    return (handler as any).extractTotal(resultText);
  }

  describe('matchDiceTable', () => {
    it('コマンドと一致する表を返す', () => {
      let table = registerTable('SAMPLE');
      let command = matchDiceTable('SAMPLE');

      expect(command.diceTable).toBe(table);
      expect(command.modifier).toBe('');
    });

    it('一致する表が無ければ null', () => {
      registerTable('SAMPLE');

      expect(matchDiceTable('OTHER')).toBeNull();
      expect(matchDiceTable('')).toBeNull();
    });

    it('表が 1 つも無ければ null', () => {
      expect(matchDiceTable('SAMPLE')).toBeNull();
    });

    it('コマンドが空の表は候補にしない', () => {
      registerTable('');

      expect(matchDiceTable('なんでも')).toBeNull();
    });

    it('全角のコマンドは半角化して照合する', () => {
      let table = registerTable('ＳＡＭＰＬＥ');

      expect(matchDiceTable('SAMPLE').diceTable).toBe(table);
    });

    it('コマンド前後の空白は無視する', () => {
      let table = registerTable('  SAMPLE  ');

      expect(matchDiceTable('SAMPLE').diceTable).toBe(table);
    });

    it('前方一致する表が複数あれば最長のコマンドを優先する', () => {
      registerTable('D');
      let longer = registerTable('DX');

      expect(matchDiceTable('DX').diceTable).toBe(longer);
    });

    // コマンド `D` の表が `D66` のような通常のダイス発言を横取りしないためのガード
    it('空白区切りが無く符号も無い続きがあれば一致しない', () => {
      registerTable('D');

      expect(matchDiceTable('D66')).toBeNull();
      expect(matchDiceTable('DX')).toBeNull();
    });

    it('符号があれば空白区切りが無くても補正値として解釈する', () => {
      registerTable('D');

      expect(matchDiceTable('D+3').modifier).toBe('+3');
      expect(matchDiceTable('D-2').modifier).toBe('-2');
    });

    it('空白区切りなら符号が無くても補正値として解釈する', () => {
      registerTable('D');

      expect(matchDiceTable('D 3').modifier).toBe('+3');
      expect(matchDiceTable('D 1d6').modifier).toBe('+1d6');
    });

    it('補正値として解釈できなければ一致しない', () => {
      registerTable('D');

      expect(matchDiceTable('D あいうえお')).toBeNull();
    });

    it('最長候補が補正値で脱落したら次の候補を試す', () => {
      let shorter = registerTable('D');
      registerTable('D+');

      // 'D+' から見た続きは '3' で符号が無いため脱落し、'D' から見た '+3' が通る
      expect(matchDiceTable('D+3').diceTable).toBe(shorter);
    });
  });

  describe('parseModifier', () => {
    it('無符号の値には + を補う', () => {
      expect(parseModifier('3')).toBe('+3');
      expect(parseModifier('1d6')).toBe('+1d6');
    });

    it('符号付きの値はそのまま通す', () => {
      expect(parseModifier('+3')).toBe('+3');
      expect(parseModifier('-2')).toBe('-2');
    });

    it('四則演算と括弧を許可する', () => {
      expect(parseModifier('2*3')).toBe('+2*3');
      expect(parseModifier('(1+2)')).toBe('+(1+2)');
      expect(parseModifier('1D6/2')).toBe('+1D6/2');
    });

    it('式として解釈できない文字列は null', () => {
      expect(parseModifier('あいうえお')).toBeNull();
      expect(parseModifier('3個')).toBeNull();
      expect(parseModifier('')).toBeNull();
    });
  });

  describe('extractTotal', () => {
    it('＞ 区切りの末尾セグメントから合計値を取る', () => {
      expect(extractTotal('(2D6+3) ＞ 9[4,5]+3 ＞ 12')).toBe(12);
    });

    it('→ 区切りにも対応する', () => {
      expect(extractTotal('(1D6) → 4')).toBe(4);
    });

    it('負の合計値を取れる', () => {
      expect(extractTotal('(1D6-10) ＞ 3-10 ＞ -7')).toBe(-7);
    });

    // 成功／失敗で終わる書式では末尾セグメントに数値が無いので行全体へフォールバックする
    it('末尾が判定結果なら行全体の末尾の整数を使う', () => {
      expect(extractTotal('(2D6) ＞ 7[3,4] ＞ 7 ＞ 成功')).toBe(7);
    });

    it('複数行なら最後の非空行を見る', () => {
      expect(extractTotal('1回目 ＞ 3\n2回目 ＞ 9')).toBe(9);
      expect(extractTotal('(1D6) ＞ 4\n\n   \n')).toBe(4);
    });

    it('数値が無ければ null', () => {
      expect(extractTotal('失敗')).toBeNull();
      expect(extractTotal('')).toBeNull();
    });
  });

  describe('makeResultMessageContext', () => {
    function makeResult(result: string, id: string = 'DiceBot:2D6', isSecret: boolean = false): DiceRollResult {
      return { id: id, result: result, isSecret: isSecret };
    }

    function makeContext(table: DiceTable, rollResult: DiceRollResult, name: string = 'カエデ') {
      return (handler as any).makeResultMessageContext(table, rollResult, name);
    }

    it('表名・ダイス結果・表の本文を並べる', () => {
      let table = registerTable('SAMPLE', '7:中吉');
      table.name = 'テスト表';

      let context = makeContext(table, makeResult('(2D6) ＞ 7[3,4] ＞ 7'));

      expect(context.result).toBe('【テスト表】\n(2D6) ＞ 7[3,4] ＞ 7\n中吉');
      expect(context.from).toBe('System-BCDice');
      expect(context.name).toBe('DiceBot : カエデ');
    });

    it('表に無い出目なら断り書きを出す', () => {
      let table = registerTable('SAMPLE', '2:凶');
      table.name = 'テスト表';

      let context = makeContext(table, makeResult('(2D6) ＞ 12[6,6] ＞ 12'));

      expect(context.result).toBe('【テスト表】\n(2D6) ＞ 12[6,6] ＞ 12\nダイス目の番号が表にありません');
    });

    it('シークレットダイスはタグと表示名に印を付ける', () => {
      let table = registerTable('SAMPLE', '7:中吉');

      let context = makeContext(table, makeResult('(2D6) ＞ 7[3,4] ＞ 7', 'DiceBot:2D6', true));

      expect(context.tag).toBe('system dicebot secret');
      expect(context.name).toBe('DiceBot : カエデ (Secret)');
    });
  });
});
