import { DiceBot } from '@udonarium/dice-bot';

/**
 * 実際に BCDice を読み込んで DiceBot の振る舞いを検証する統合テスト。
 * ダイス目は当然ランダムなので、値ではなく出力の形と分類を assert する。
 */
describe('DiceBot (BCDice 統合)', () => {
  // 初回のみ動的 import が走るので長めに待つ（isInitialized はモジュールスコープで一度きり）
  beforeAll(async () => { await DiceBot.initialize(); }, 60000);

  it('初期化するとゲームシステム一覧が読み込まれる', () => {
    expect(DiceBot.infos.length).toBeGreaterThan(0);
    expect(DiceBot.infos.some(info => info.id === 'DiceBot')).toBe(true);
  });

  describe('diceRollAsync', () => {
    it('基本のダイス式を振れる', async () => {
      let result = await DiceBot.diceRollAsync('2d6');

      expect(result.id).toBe('DiceBot');
      expect(result.isSecret).toBe(false);
      expect(result.result).toMatch(/^\(2D6\) ＞ \d+\[\d,\d\] ＞ \d+$/);
    });

    // COMMAND_PATTERN に一致しない発言は、ダイスとして扱わず「振れなかった」として空の結果を返す。
    it('ダイス式でない文字列は空の結果を返す', async () => {
      let result = await DiceBot.diceRollAsync('こんにちは');

      expect(result.result).toBe('');
      expect(result.isSecret).toBe(false);
    });

    it('S を前置するとシークレットダイスになる', async () => {
      let result = await DiceBot.diceRollAsync('S2d6');

      expect(result.isSecret).toBe(true);
      expect(result.result).toMatch(/^\(2D6\) ＞ \d+\[\d,\d\] ＞ \d+$/);
    });

    it('成功判定は末尾が数値でなく判定結果になる', async () => {
      let result = await DiceBot.diceRollAsync('1d100<=50');

      expect(result.result).toMatch(/^\(1D100<=50\) ＞ \d+ ＞ (成功|失敗)$/);
    });
  });

  describe('ゲームシステムの解決', () => {
    it('指定したゲームシステムの ID を返す', async () => {
      let result = await DiceBot.diceRollAsync('2d6', 'SwordWorld2.5');

      expect(result.id).toBe('SwordWorld2.5');
    });

    it('ゲームシステム固有のコマンドを解釈する', async () => {
      let result = await DiceBot.diceRollAsync('k20', 'SwordWorld2.5');

      expect(result.result).toMatch(/^KeyNo\.20/);
    });

    // 存在しない ID は loadGameSystemAsync が 'DiceBot' に読み替える
    it('未知のゲームシステムは DiceBot にフォールバックする', async () => {
      let result = await DiceBot.diceRollAsync('2d6', 'NoSuchGameSystem');

      expect(result.id).toBe('DiceBot');
      expect(result.result).toMatch(/^\(2D6\) ＞ /);
    });
  });

  // BCDice の生出力は `#1\n(2D6) ＞ …\n#2\n…` と番号が独立行になる。
  // diceRollAsync の replace(/\n?(#\d+)\n/ig, '$1 ') がこれを 1 行に畳んでいる
  describe('繰り返しダイスの改行正規化', () => {
    it('回数の番号を結果と同じ行にまとめる', async () => {
      let result = await DiceBot.diceRollAsync('REP3 2d6');
      let lines = result.result.split('\n');

      expect(lines.length).toBe(3);
      lines.forEach((line, i) => expect(line).toMatch(new RegExp(`^#${i + 1} \\(2D6\\) ＞ `)));
    });

    it('x 記法でも同じ結果になる', async () => {
      let result = await DiceBot.diceRollAsync('x2 2d6');
      let lines = result.result.split('\n');

      expect(lines.length).toBe(2);
      expect(lines[0]).toMatch(/^#1 \(2D6\) ＞ /);
      expect(lines[1]).toMatch(/^#2 \(2D6\) ＞ /);
    });
  });
});
