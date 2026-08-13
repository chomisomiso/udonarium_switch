import { ChatPalette } from '@udonarium/chat-palette';
import { DataElement } from '@udonarium/data-element';
import { resetGameObjects } from 'testing/game-object-testing';

describe('ChatPalette', () => {
  afterEach(resetGameObjects);

  /** キャラのデータ要素ツリーの代わり。evaluate() の extendVariables / targetVariables に渡す */
  function makeVariables(): DataElement {
    return DataElement.create('data');
  }

  /** numberResource は value が最大値、currentValue が現在値 */
  function addResource(root: DataElement, name: string, current: number, max: number): void {
    root.appendChild(DataElement.create(name, max, { type: 'numberResource', currentValue: current + '' }));
  }

  function addPlain(root: DataElement, name: string, value: string): void {
    root.appendChild(DataElement.create(name, value));
  }

  function makePalette(source: string = ''): ChatPalette {
    let palette = new ChatPalette();
    palette.setPalette(source);
    return palette;
  }

  describe('hasTargetNotation', () => {
    it('t{} を含む', () => {
      expect(ChatPalette.hasTargetNotation('t{HP}')).toBe(true);
    });

    it('全角の t・波括弧も含む', () => {
      expect(ChatPalette.hasTargetNotation('ｔ{HP}')).toBe(true);
      expect(ChatPalette.hasTargetNotation('T｛HP｝')).toBe(true);
      expect(ChatPalette.hasTargetNotation('Ｔ｛HP｝')).toBe(true);
    });

    it('最大値サフィックス付きも含む', () => {
      expect(ChatPalette.hasTargetNotation('t{HP^}')).toBe(true);
    });

    it('行の途中にあっても見つける', () => {
      expect(ChatPalette.hasTargetNotation('2d6+{命中} 対 t{回避}')).toBe(true);
    });

    it('自分参照の {} だけなら含まない', () => {
      expect(ChatPalette.hasTargetNotation('2d6+{命中}')).toBe(false);
    });

    it('リソース操作コマンドは含まない', () => {
      expect(ChatPalette.hasTargetNotation('t:HP-5')).toBe(false);
    });

    it('波括弧が無ければ含まない', () => {
      expect(ChatPalette.hasTargetNotation('ただの発言')).toBe(false);
    });

    // evaluate() と正規表現を共用しているため、lastIndex が残ると交互に false を返す
    it('同じ入力を続けて判定しても結果が変わらない', () => {
      expect(ChatPalette.hasTargetNotation('t{HP}')).toBe(true);
      expect(ChatPalette.hasTargetNotation('t{HP}')).toBe(true);
      expect(ChatPalette.hasTargetNotation('t{HP}')).toBe(true);
    });
  });

  describe('evaluate - 自分の参照', () => {
    it('パレット変数を展開する', () => {
      let palette = makePalette('//命中=2d6+3');

      expect(palette.evaluate('{命中}')).toBe('2d6+3');
    });

    it('パレット変数はデータ要素より優先される', () => {
      let palette = makePalette('//HP=変数のほう');
      let self = makeVariables();
      addResource(self, 'HP', 30, 50);

      expect(palette.evaluate('{HP}', self)).toBe('変数のほう');
    });

    it('リソースは現在値を展開する', () => {
      let self = makeVariables();
      addResource(self, 'HP', 30, 50);

      expect(makePalette().evaluate('{HP}', self)).toBe('30');
    });

    it('^ を付けると最大値を展開する', () => {
      let self = makeVariables();
      addResource(self, 'HP', 30, 50);

      expect(makePalette().evaluate('{HP^}', self)).toBe('50');
    });

    it('リソースでない項目は値をそのまま展開する', () => {
      let self = makeVariables();
      addPlain(self, '打撃点', '7');

      expect(makePalette().evaluate('{打撃点}', self)).toBe('7');
    });

    it('解決できない名前は空文字になる', () => {
      expect(makePalette().evaluate('[{知らない項目}]', makeVariables())).toBe('[]');
    });
  });

  describe('evaluate - ターゲットの参照', () => {
    let self: DataElement;
    let target: DataElement;

    beforeEach(() => {
      self = makeVariables();
      addResource(self, 'HP', 30, 50);
      addPlain(self, '打撃点', '7');

      target = makeVariables();
      addResource(target, 'HP', 12, 40);
      addPlain(target, '防護点', '3');
    });

    it('t{} はターゲットのリソースの現在値を展開する', () => {
      expect(makePalette().evaluate('t{HP}', self, target)).toBe('12');
    });

    it('t{} でも ^ で最大値を展開する', () => {
      expect(makePalette().evaluate('t{HP^}', self, target)).toBe('40');
    });

    it('全角の t・波括弧でも展開する', () => {
      expect(makePalette().evaluate('ｔ｛防護点｝', self, target)).toBe('3');
    });

    // 1行に混在するのがこの記法の主用途
    it('同じ行の {} は自分、t{} はターゲットを見る', () => {
      expect(makePalette().evaluate('{打撃点}-t{防護点} 残りt{HP}/t{HP^}', self, target))
        .toBe('7-3 残り12/40');
    });

    it('ターゲットを渡さないと t{} は空文字になる', () => {
      expect(makePalette().evaluate('[t{HP}]', self)).toBe('[]');
    });

    it('ターゲットに無い項目は空文字になる', () => {
      expect(makePalette().evaluate('[t{打撃点}]', self, target)).toBe('[]');
    });

    // ターゲット側のパレット変数までは引かない（自分のパレット変数にも寄せない）
    it('t{} はパレット変数を引かない', () => {
      expect(makePalette('//防護点=変数のほう').evaluate('t{防護点}', self, target)).toBe('3');
    });
  });

  // コメントで仕様として宣言している挙動。リファクタで静かに変わらないよう固定しておく
  describe('evaluate - 割り切っている挙動', () => {
    it('ASCII の t の直後の {} はターゲット参照と誤認される', () => {
      let self = makeVariables();
      addPlain(self, 'HP', '30');

      expect(ChatPalette.hasTargetNotation('Result{HP}')).toBe(true);
      expect(makePalette().evaluate('Result{HP}', self)).toBe('Resul');
    });

    // 検出は展開前のテキストだけを見るので、変数を経由した t{} は通常パスに落ちて空文字になる
    it('パレット変数の中の t{} は検出をすり抜けて空文字になる', () => {
      let palette = makePalette('//攻撃=2d6 vs t{回避}');

      expect(ChatPalette.hasTargetNotation('{攻撃}')).toBe(false);
      expect(palette.evaluate('{攻撃}', makeVariables())).toBe('2d6 vs ');
    });
  });
});
