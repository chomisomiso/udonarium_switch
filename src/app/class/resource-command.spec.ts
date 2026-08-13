import { ResourceCommand } from '@udonarium/resource-command';

describe('ResourceCommand', () => {

  describe('make', () => {
    it('増加コマンドを組み立てる', () => {
      expect(ResourceCommand.make({ resourceName: 'HP', value: 5 })).toBe(':HP+5');
    });

    it('減少コマンドは符号を重ねない', () => {
      expect(ResourceCommand.make({ resourceName: 'HP', value: -5 })).toBe(':HP-5');
    });

    it('0 にも符号を付ける', () => {
      expect(ResourceCommand.make({ resourceName: 'HP', value: 0 })).toBe(':HP+0');
    });

    it('ターゲット指定', () => {
      expect(ResourceCommand.make({ resourceName: 'HP', value: 5, isTargetMode: true })).toBe('t:HP+5');
    });

    it('最大値操作はリソース名の後ろに ^ を付ける', () => {
      expect(ResourceCommand.make({ resourceName: 'HP', value: 5, isMaxValue: true })).toBe(':HP^+5');
    });

    it('オプションは Z L の順で並ぶ', () => {
      expect(ResourceCommand.make({ resourceName: 'HP', value: -5, zeroLimit: true })).toBe(':HP-5Z');
      expect(ResourceCommand.make({ resourceName: 'HP', value: 5, rangeLimit: true })).toBe(':HP+5L');
      expect(ResourceCommand.make({ resourceName: 'HP', value: 5, zeroLimit: true, rangeLimit: true })).toBe(':HP+5ZL');
    });

    it('全部盛り', () => {
      expect(ResourceCommand.make({
        resourceName: 'HP', value: -3, isTargetMode: true, isMaxValue: true, zeroLimit: true, rangeLimit: true,
      })).toBe('t:HP^-3ZL');
    });

    it('前後の空白は落とす', () => {
      expect(ResourceCommand.make({ resourceName: '  HP  ', value: 5 })).toBe(':HP+5');
    });
  });

  describe('make - 解釈を壊す指定を弾く', () => {
    it('リソース名が空なら null', () => {
      expect(ResourceCommand.make({ resourceName: '', value: 5 })).toBeNull();
      expect(ResourceCommand.make({ resourceName: '   ', value: 5 })).toBeNull();
    });

    it('リソース名に空白が入ると発言が分割されるので null', () => {
      expect(ResourceCommand.make({ resourceName: '魔力 残量', value: 5 })).toBeNull();
    });

    it('リソース名に演算子が入ると null', () => {
      for (let name of ['HP+', 'H-P', 'HP=', 'HP>', 'H:P']) {
        expect(ResourceCommand.make({ resourceName: name, value: 5 })).withContext(name).toBeNull();
      }
    });

    it('リソース名に ^ が入ると最大値指定と混ざるので null', () => {
      expect(ResourceCommand.make({ resourceName: 'HP^', value: 5 })).toBeNull();
    });

    // 小数は解釈側の数式判定 /[^d\d()+\-*\/]/ を通らず、文字列として扱われてしまう
    it('小数は null', () => {
      expect(ResourceCommand.make({ resourceName: 'HP', value: 1.5 })).toBeNull();
      expect(ResourceCommand.make({ resourceName: 'HP', value: NaN })).toBeNull();
    });
  });

  describe('parse - 基本の書式', () => {
    function self(text: string) { return ResourceCommand.parse(text)[0]; }

    it('減算コマンドを解釈する', () => {
      expect(self(':HP-5')).toEqual([{
        resource: 'HP',
        operator: '-',
        // BCDice 向けの整形は実行側で行うので、ここでは生の値のまま
        command: '5',
        isCalculate: true,
        enableOptionL: false,
        enableOptionZ: false,
        enableOptionMax: false,
      }]);
    });

    it('加算・代入コマンドを解釈する', () => {
      expect(self(':HP+5')[0].operator).toBe('+');
      expect(self(':HP=10')[0].operator).toBe('=');
      expect(self(':HP=10')[0].command).toBe('10');
    });

    it('ダイス式を数式として扱う', () => {
      let command = self(':HP+1d6')[0];

      expect(command.isCalculate).toBe(true);
      expect(command.command).toBe('1d6');
    });

    // 数式に使えない文字が混ざると計算式ではなく文字列として扱う
    it('数式でない指定は文字列として扱う', () => {
      let command = self(':状態>毒')[0];

      expect(command.isCalculate).toBe(false);
      expect(command.operator).toBe('>');
      expect(command.command).toBe('毒');
    });

    it('コマンドが無ければ空配列', () => {
      expect(ResourceCommand.parse('ふつうの発言')).toEqual([[], []]);
      expect(ResourceCommand.parse('')).toEqual([[], []]);
    });
  });

  describe('parse - 対象の指定', () => {
    it('接頭辞なしは自分向け、t: はターゲット向け', () => {
      let [selfCommands, targetCommands] = ResourceCommand.parse(':HP-5 t:MP-3');

      expect(selfCommands.map(c => c.resource)).toEqual(['HP']);
      expect(targetCommands.map(c => c.resource)).toEqual(['MP']);
    });
  });

  describe('parse - オプション', () => {
    function first(text: string) { return ResourceCommand.parse(text)[0][0]; }

    it('L は値域制限', () => {
      let command = first(':HP+5L');

      expect(command.enableOptionL).toBe(true);
      expect(command.enableOptionZ).toBe(false);
      expect(command.command).toBe('5');   // オプション文字は式から取り除く
    });

    it('Z は 0 制限', () => {
      let command = first(':HP-5Z');

      expect(command.enableOptionZ).toBe(true);
      expect(command.enableOptionL).toBe(false);
    });

    it('LZ / ZL はどちらの順でも両方有効', () => {
      for (let text of [':HP-5LZ', ':HP-5ZL']) {
        let command = first(text);
        expect(command.enableOptionL).withContext(text).toBe(true);
        expect(command.enableOptionZ).withContext(text).toBe(true);
        expect(command.command).withContext(text).toBe('5');
      }
    });

    it('リソース名末尾の ^ は最大値操作', () => {
      let command = first(':HP^-5');

      expect(command.enableOptionMax).toBe(true);
      expect(command.resource).toBe('HP');   // ^ はリソース名から取り除く
    });
  });

  describe('parse - 複数コマンドと全角', () => {
    function self(text: string) { return ResourceCommand.parse(text)[0]; }

    it('空白区切りで並べられる', () => {
      expect(self(':HP-5 :MP-3').map(c => c.resource)).toEqual(['HP', 'MP']);
    });

    it('空白を挟まず連結しても分解する', () => {
      expect(self(':HP-5:MP-3').map(c => c.resource)).toEqual(['HP', 'MP']);
    });

    it('通常の発言に混ざっていても拾う', () => {
      expect(self('攻撃を受けた :HP-5 いたい').map(c => c.resource)).toEqual(['HP']);
    });

    it('全角のコマンドを半角として解釈する', () => {
      let command = self('：ＨＰ－５')[0];

      expect(command.resource).toBe('HP');
      expect(command.operator).toBe('-');
      expect(command.command).toBe('5');
    });

    it('全角のターゲット指定も解釈する', () => {
      expect(ResourceCommand.parse('ｔ：ＭＰ＋３')[1].length).toBe(1);
    });

    // commandRegToken だけが /i だった頃は、大文字が commandRegParts に落ちず例外になっていた
    it('大文字のターゲット指定も解釈する', () => {
      expect(() => ResourceCommand.parse('T:HP-5')).not.toThrow();
      expect(ResourceCommand.parse('T:HP-5')[1].length).toBe(1);
    });

    // 行全体に正規表現を当てているので、地の文を挟んでも取りこぼさない
    it('地の文を挟んだ複数コマンドを拾う', () => {
      let [selfCommands, targetCommands] = ResourceCommand.parse(':HP+5 斬りつけた t:MP-1');

      expect(selfCommands.length).toBe(1);
      expect(targetCommands.length).toBe(1);
      expect(selfCommands[0].resource).toBe('HP');
      expect(targetCommands[0].resource).toBe('MP');
    });

    it('改行で区切られていても拾う', () => {
      let [selfCommands, targetCommands] = ResourceCommand.parse(':HP+5\nt:MP-1');

      expect(selfCommands.length).toBe(1);
      expect(targetCommands.length).toBe(1);
    });
  });

  // 走査の機構そのものは command-token.spec.ts が担当する。ここは t: の意味だけ見る
  describe('stripNonTargetCommands', () => {
    it('自分向けは落ちてターゲット向けは残る', () => {
      expect(ResourceCommand.stripNonTargetCommands('t:HP-5 :MP+1')).toBe('t:HP-5');
    });

    // 空白なしで混在したトークンを切り分けられること。これができないと MP が N 回減る
    it('空白なしで混在していても切り分ける', () => {
      expect(ResourceCommand.stripNonTargetCommands('t:HP-5:MP+1')).toBe('t:HP-5');
    });

    it('全角の接頭辞も判定できる', () => {
      expect(ResourceCommand.stripNonTargetCommands('ｔ：ＨＰ－５ ：ＭＰ＋１')).toBe('ｔ：ＨＰ－５');
    });

    it('大文字の接頭辞も判定できる', () => {
      expect(ResourceCommand.stripNonTargetCommands('T:HP-5 :MP+1')).toBe('T:HP-5');
    });

    // 値の文字クラスが空白を含むと、:MP+1 が後続の t: を飲み込んで両方消える
    it('落とす側が先にあっても後続を巻き込まない', () => {
      expect(ResourceCommand.stripNonTargetCommands(':MP+1 t:HP-5')).toBe('t:HP-5');
    });

    // parse() と対で整合していること
    it('結果を parse すると自分向けが空になる', () => {
      let [selfCommands, targetCommands] = ResourceCommand.parse(ResourceCommand.stripNonTargetCommands('t:HP-5 :MP+1'));

      expect(selfCommands).toEqual([]);
      expect(targetCommands.length).toBe(1);
      expect(targetCommands[0].resource).toBe('HP');
    });
  });

  /**
   * make で組み立てた文字列を parse が意図どおり読み戻せることを確認する。
   * 組み立て側の制約は解釈側の文法から導かれているので、この往復が両者の整合を保証する。
   */
  describe('round-trip（make → parse）', () => {
    function first(options: any) { return ResourceCommand.parse(ResourceCommand.make(options))[0][0]; }

    it('リソース名と演算子が意図どおり読まれる', () => {
      let command = first({ resourceName: 'HP', value: -5 });

      expect(command.resource).toBe('HP');
      expect(command.operator).toBe('-');
      expect(command.command).toBe('5');
      expect(command.isCalculate).toBe(true);
    });

    it('増加と減少が区別される', () => {
      expect(first({ resourceName: 'HP', value: 5 }).operator).toBe('+');
      expect(first({ resourceName: 'HP', value: -5 }).operator).toBe('-');
    });

    it('ターゲット指定が保たれる', () => {
      let [selfCommands, targetCommands] = ResourceCommand.parse(
        ResourceCommand.make({ resourceName: 'HP', value: 5, isTargetMode: true }));

      expect(selfCommands.length).toBe(0);
      expect(targetCommands.length).toBe(1);
    });

    it('最大値操作が読まれ、リソース名から ^ が外れる', () => {
      let command = first({ resourceName: 'HP', value: 5, isMaxValue: true });

      expect(command.enableOptionMax).toBe(true);
      expect(command.resource).toBe('HP');
    });

    it('Z / L オプションが読まれ、式から取り除かれる', () => {
      let command = first({ resourceName: 'HP', value: -5, zeroLimit: true, rangeLimit: true });

      expect(command.enableOptionZ).toBe(true);
      expect(command.enableOptionL).toBe(true);
      expect(command.command).toBe('5');
    });

    it('全部盛りが破綻しない', () => {
      let [, targetCommands] = ResourceCommand.parse(ResourceCommand.make({
        resourceName: 'MP', value: -3, isTargetMode: true, isMaxValue: true, zeroLimit: true, rangeLimit: true,
      }));

      expect(targetCommands).toEqual([{
        resource: 'MP',
        operator: '-',
        command: '3',
        isCalculate: true,
        enableOptionL: true,
        enableOptionZ: true,
        enableOptionMax: true,
      }]);
    });
  });
});
