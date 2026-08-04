import { ResourceCommandHandler } from '@udonarium/resource-command-handler';
import { resetGameObjects } from 'testing/game-object-testing';

/**
 * リソース操作コマンドの文法解釈だけを検証する。
 * 実際の加減算は BCDice とキャラクターのデータ要素を伴うため、ここでは扱わない。
 */
describe('ResourceCommandHandler', () => {
  let handler: ResourceCommandHandler;

  beforeEach(() => {
    handler = new ResourceCommandHandler();
  });

  afterEach(resetGameObjects);

  function extractCommand(text: string): [any[], any[]] {
    return (handler as any).extractCommand(text);
  }

  function self(text: string): any[] {
    return extractCommand(text)[0];
  }

  function target(text: string): any[] {
    return extractCommand(text)[1];
  }

  describe('基本の書式', () => {
    it('減算コマンドを解釈する', () => {
      expect(self(':HP-5')).toEqual([{
        resource: 'HP',
        operator: '-',
        // 数式のみなので符号を前置し、BCDice に投げるためのダミーダイスを付ける
        command: '-5+(1d1-1)',
        isCalculate: true,
        enableOptionL: false,
        enableOptionZ: false,
        enableOptionMax: false,
      }]);
    });

    it('加算コマンドには符号を前置しない', () => {
      expect(self(':HP+5')[0].command).toBe('5+(1d1-1)');
      expect(self(':HP+5')[0].operator).toBe('+');
    });

    it('代入コマンドを解釈する', () => {
      let command = self(':HP=10')[0];

      expect(command.operator).toBe('=');
      expect(command.command).toBe('10+(1d1-1)');
    });

    it('ダイス式を数式として扱う', () => {
      let command = self(':HP+1d6')[0];

      expect(command.isCalculate).toBe(true);
      expect(command.command).toBe('1d6+(1d1-1)');
    });

    // 数式に使えない文字が混ざると計算式ではなく文字列として扱い、ダミーダイスも付けない
    it('数式でない指定は文字列として扱う', () => {
      let command = self(':状態>毒')[0];

      expect(command.isCalculate).toBe(false);
      expect(command.operator).toBe('>');
      expect(command.command).toBe('毒');
    });

    it('コマンドが無ければ空配列', () => {
      expect(extractCommand('ふつうの発言')).toEqual([[], []]);
      expect(extractCommand('')).toEqual([[], []]);
    });
  });

  describe('対象の指定', () => {
    it('接頭辞なしは自分向け', () => {
      let [selfCommands, targetCommands] = extractCommand(':HP-5');

      expect(selfCommands.length).toBe(1);
      expect(targetCommands.length).toBe(0);
    });

    it('t: はターゲット向け', () => {
      let [selfCommands, targetCommands] = extractCommand('t:MP+1d6');

      expect(selfCommands.length).toBe(0);
      expect(targetCommands.length).toBe(1);
      expect(targetCommands[0].resource).toBe('MP');
    });

    it('自分向けとターゲット向けを同時に指定できる', () => {
      let [selfCommands, targetCommands] = extractCommand(':HP-5 t:MP-3');

      expect(selfCommands.map(c => c.resource)).toEqual(['HP']);
      expect(targetCommands.map(c => c.resource)).toEqual(['MP']);
    });
  });

  describe('オプション', () => {
    it('L は値域制限', () => {
      let command = self(':HP+5L')[0];

      expect(command.enableOptionL).toBe(true);
      expect(command.enableOptionZ).toBe(false);
      expect(command.command).toBe('5+(1d1-1)');   // オプション文字は式から取り除く
    });

    it('Z は 0 制限', () => {
      let command = self(':HP-5Z')[0];

      expect(command.enableOptionZ).toBe(true);
      expect(command.enableOptionL).toBe(false);
      expect(command.command).toBe('-5+(1d1-1)');
    });

    it('LZ は両方有効', () => {
      let command = self(':HP-5LZ')[0];

      expect(command.enableOptionL).toBe(true);
      expect(command.enableOptionZ).toBe(true);
      expect(command.command).toBe('-5+(1d1-1)');
    });

    it('ZL の順でも両方有効', () => {
      let command = self(':HP-5ZL')[0];

      expect(command.enableOptionL).toBe(true);
      expect(command.enableOptionZ).toBe(true);
      expect(command.command).toBe('-5+(1d1-1)');
    });

    it('リソース名末尾の ^ は最大値操作', () => {
      let command = self(':HP^-5')[0];

      expect(command.enableOptionMax).toBe(true);
      expect(command.resource).toBe('HP');   // ^ はリソース名から取り除く
    });

    it('オプションを組み合わせられる', () => {
      let command = self(':HP^-5LZ')[0];

      expect(command.enableOptionMax).toBe(true);
      expect(command.enableOptionL).toBe(true);
      expect(command.enableOptionZ).toBe(true);
      expect(command.resource).toBe('HP');
    });
  });

  describe('複数コマンド', () => {
    it('空白区切りで並べられる', () => {
      expect(self(':HP-5 :MP-3').map(c => c.resource)).toEqual(['HP', 'MP']);
    });

    it('空白を挟まず連結しても分解する', () => {
      expect(self(':HP-5:MP-3').map(c => c.resource)).toEqual(['HP', 'MP']);
    });

    it('通常の発言に混ざっていても拾う', () => {
      expect(self('攻撃を受けた :HP-5 いたい').map(c => c.resource)).toEqual(['HP']);
    });
  });

  describe('全角入力', () => {
    it('全角のコマンドを半角として解釈する', () => {
      let command = self('：ＨＰ－５')[0];

      expect(command.resource).toBe('HP');
      expect(command.operator).toBe('-');
      expect(command.command).toBe('-5+(1d1-1)');
    });

    it('全角のターゲット指定も解釈する', () => {
      expect(target('ｔ：ＭＰ＋３').length).toBe(1);
    });
  });
});
