import { ResourceCommand } from '@udonarium/resource-command';
import { ResourceCommandHandler } from '@udonarium/resource-command-handler';
import { resetGameObjects } from 'testing/game-object-testing';

/**
 * コマンドの文法は resource-command.spec.ts が担当する。
 * ここでは解釈済みのコマンドを BCDice へ渡すまでの整形だけを見る。
 */
describe('ResourceCommandHandler', () => {
  let handler: ResourceCommandHandler;

  beforeEach(() => {
    handler = new ResourceCommandHandler();
  });

  afterEach(resetGameObjects);

  /** 発言を解釈して、BCDice へ渡す式に整形するまでを通す */
  function toDiceExpression(text: string): string {
    let command = ResourceCommand.parse(text)[0][0];
    return (handler as any).toDiceExpression(command);
  }

  describe('toDiceExpression', () => {
    // 単体の数値も式として評価させるためダミーダイスを足す
    it('数式にはダミーダイスを足す', () => {
      expect(toDiceExpression(':HP+5')).toBe('5+(1d1-1)');
    });

    it('減算では符号を前置する', () => {
      expect(toDiceExpression(':HP-5')).toBe('-5+(1d1-1)');
    });

    it('ダイス式にも足す', () => {
      expect(toDiceExpression(':HP+1d6')).toBe('1d6+(1d1-1)');
    });

    it('オプション文字は式に残さない', () => {
      expect(toDiceExpression(':HP-5ZL')).toBe('-5+(1d1-1)');
    });

    it('代入では符号を前置しない', () => {
      expect(toDiceExpression(':HP=10')).toBe('10+(1d1-1)');
    });

    // 文字列指定は BCDice に渡さずそのまま値として使うので整形しない
    it('数式でない指定はそのまま返す', () => {
      expect(toDiceExpression(':状態>毒')).toBe('毒');
    });

    // 以前は解釈の段階でダミーダイスを足していたため、
    // `:状態>5` が `5+(1d1-1)` という文字列としてリソースへ書き込まれていた
    it('文字列設定に数値を渡してもダミーダイスが混ざらない', () => {
      let command = ResourceCommand.parse(':状態>5')[0][0];

      expect(command.command).toBe('5');
      expect(command.operator).toBe('>');
    });
  });
});
