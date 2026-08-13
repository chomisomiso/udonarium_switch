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

  /** ターゲット未指定で展開したときに t{} を踏んだか */
  function usedTarget(text: string, palette: ChatPalette = makePalette()): boolean {
    return palette.expand(text, makeVariables()).usedTarget;
  }

  describe('expand - usedTarget', () => {
    it('t{} を踏むと立つ', () => {
      expect(usedTarget('t{HP}')).toBe(true);
    });

    it('全角の t・波括弧でも立つ', () => {
      expect(usedTarget('ｔ{HP}')).toBe(true);
      expect(usedTarget('T｛HP｝')).toBe(true);
      expect(usedTarget('Ｔ｛HP｝')).toBe(true);
    });

    it('最大値サフィックス付きでも立つ', () => {
      expect(usedTarget('t{HP^}')).toBe(true);
    });

    it('行の途中にあっても立つ', () => {
      expect(usedTarget('2d6+{命中} 対 t{回避}')).toBe(true);
    });

    // 解決の成否とは無関係。踏んだ事実だけを見る
    it('ターゲットに無い項目でも立つ', () => {
      expect(makePalette().expand('t{知らない項目}', makeVariables(), makeVariables()).usedTarget).toBe(true);
    });

    it('自分参照の {} だけなら立たない', () => {
      expect(usedTarget('2d6+{命中}')).toBe(false);
    });

    it('リソース操作コマンドでは立たない', () => {
      expect(usedTarget('t:HP-5')).toBe(false);
    });

    it('波括弧が無ければ立たない', () => {
      expect(usedTarget('ただの発言')).toBe(false);
    });

    // 事前走査をやめた理由そのもの。変数は展開して初めて t{} が現れる
    it('パレット変数の中に隠れた t{} でも立つ', () => {
      expect(usedTarget('{攻撃}', makePalette('//攻撃=2d6 vs t{回避}'))).toBe(true);
    });

    // static な g フラグ付き正規表現を呼び出し間で使い回しているため、lastIndex が残ると結果がぶれる
    it('同じ入力を続けて展開しても結果が変わらない', () => {
      expect(usedTarget('t{HP}')).toBe(true);
      expect(usedTarget('t{HP}')).toBe(true);
      expect(usedTarget('t{HP}')).toBe(true);
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

    // 事前走査をやめたので、変数を経由した t{} もターゲットの値で埋まる
    it('パレット変数の中の t{} もターゲットの値で展開される', () => {
      let palette = makePalette('//攻撃=2d6 vs t{防護点}');

      expect(palette.evaluate('{攻撃}', self, target)).toBe('2d6 vs 3');
    });
  });

  // コメントで仕様として宣言している挙動。リファクタで静かに変わらないよう固定しておく
  describe('evaluate - 割り切っている挙動', () => {
    it('ASCII の t の直後の {} はターゲット参照と誤認される', () => {
      let self = makeVariables();
      addPlain(self, 'HP', '30');

      let expansion = makePalette().expand('Result{HP}', self);

      expect(expansion.usedTarget).toBe(true);
      expect(expansion.text).toBe('Resul');
    });
  });
});
