import { BuffCommand } from '@udonarium/buff-command';

describe('BuffCommand', () => {

  describe('makeAdd', () => {
    it('名前・R数・効果を並べる', () => {
      expect(BuffCommand.makeAdd({ name: '祝福', round: 3, effect: '命中+1' })).toBe('&祝福/3/命中+1');
    });

    it('R数を省略すると無期限', () => {
      expect(BuffCommand.makeAdd({ name: '祝福', effect: '命中+1' })).toBe('&祝福/命中+1');
      expect(BuffCommand.makeAdd({ name: '祝福', round: null, effect: '命中+1' })).toBe('&祝福/命中+1');
      expect(BuffCommand.makeAdd({ name: '祝福', round: NaN, effect: '命中+1' })).toBe('&祝福/命中+1');
    });

    it('効果を省略できる', () => {
      expect(BuffCommand.makeAdd({ name: '祝福', round: 3 })).toBe('&祝福/3');
      expect(BuffCommand.makeAdd({ name: '祝福' })).toBe('&祝福');
    });

    // 従来はコンポーネント側が truthy 判定で 0 を落としていたため 0R を指定できなかった
    it('R数 0 を指定できる', () => {
      expect(BuffCommand.makeAdd({ name: '祝福', round: 0 })).toBe('&祝福/0');
    });

    it('前後の空白は落とす', () => {
      expect(BuffCommand.makeAdd({ name: '  祝福  ', effect: '  命中+1  ' })).toBe('&祝福/命中+1');
    });

    it('対象に応じて接頭辞が変わる', () => {
      expect(BuffCommand.makeAdd({ name: '祝福', target: 'self' })).toBe('&祝福');
      expect(BuffCommand.makeAdd({ name: '祝福', target: 'target' })).toBe('t&祝福');
      expect(BuffCommand.makeAdd({ name: '祝福', target: 'all' })).toBe('a&祝福');
    });
  });

  describe('makeAdd - 解釈を壊す指定を弾く', () => {
    it('名前が空なら null', () => {
      expect(BuffCommand.makeAdd({ name: '' })).toBeNull();
      expect(BuffCommand.makeAdd({ name: '   ' })).toBeNull();
    });

    it('名前に空白が入ると発言が分割されるので null', () => {
      expect(BuffCommand.makeAdd({ name: '攻撃 強化' })).toBeNull();
    });

    it('名前に / が入るとR数・効果と混ざるので null', () => {
      expect(BuffCommand.makeAdd({ name: '攻撃/防御' })).toBeNull();
    });

    it('名前が - で終わると削除コマンドになるので null', () => {
      expect(BuffCommand.makeAdd({ name: '強化-' })).toBeNull();
    });

    it('名前が D だと期限切れ削除コマンドと衝突するので null', () => {
      expect(BuffCommand.makeAdd({ name: 'D' })).toBeNull();
      expect(BuffCommand.makeAdd({ name: 'ｄ' })).toBeNull();
    });

    it('名前に & が入ると null', () => {
      expect(BuffCommand.makeAdd({ name: '攻&防' })).toBeNull();
    });

    it('効果に空白や / が入ると null', () => {
      expect(BuffCommand.makeAdd({ name: '祝福', effect: '命中 +1' })).toBeNull();
      expect(BuffCommand.makeAdd({ name: '祝福', effect: '命中+1/回避+1' })).toBeNull();
    });

    it('R数が整数でなければ null', () => {
      expect(BuffCommand.makeAdd({ name: '祝福', round: 1.5 })).toBeNull();
      expect(BuffCommand.makeAdd({ name: '祝福', round: -1 })).toBeNull();
    });
  });

  describe('その他の組み立て', () => {
    it('makeRemove', () => {
      expect(BuffCommand.makeRemove('祝福')).toBe('&祝福-');
      expect(BuffCommand.makeRemove('祝福', 'target')).toBe('t&祝福-');
    });

    it('makeRemove は R を弾く（ラウンド減少コマンドと衝突する）', () => {
      expect(BuffCommand.makeRemove('R')).toBeNull();
      expect(BuffCommand.makeRemove('ｒ')).toBeNull();
    });

    it('makeChangeRound は符号だけを見る', () => {
      expect(BuffCommand.makeChangeRound(-1)).toBe('&R-');
      expect(BuffCommand.makeChangeRound(5)).toBe('&R+');
      expect(BuffCommand.makeChangeRound(-99, 'all')).toBe('a&R-');
      expect(BuffCommand.makeChangeRound(0)).toBeNull();
    });

    it('makeRemoveExpired', () => {
      expect(BuffCommand.makeRemoveExpired()).toBe('&D');
      expect(BuffCommand.makeRemoveExpired('all')).toBe('a&D');
    });

    it('makeProgressRound はラウンド減少と期限切れ削除を並べる', () => {
      expect(BuffCommand.makeProgressRound()).toBe('&R- &D');
    });
  });

  describe('parse - バフの追加', () => {
    function self(text: string) { return BuffCommand.parse(text)[0]; }

    it('バフ名・R数・効果を解釈する', () => {
      expect(self('&祝福/3/命中+1').addBuffs).toEqual([
        { buffName: '祝福', buffEffect: '命中+1', expire: 3 },
      ]);
    });

    it('R数と効果は順不同', () => {
      expect(self('&祝福/命中+1/3').addBuffs).toEqual([
        { buffName: '祝福', buffEffect: '命中+1', expire: 3 },
      ]);
    });

    it('R数を省略すると無期限', () => {
      expect(self('&祝福/命中+1').addBuffs).toEqual([
        { buffName: '祝福', buffEffect: '命中+1', expire: null },
      ]);
    });

    it('効果を省略できる', () => {
      expect(self('&祝福/3').addBuffs).toEqual([
        { buffName: '祝福', buffEffect: '', expire: 3 },
      ]);
    });

    it('バフ名だけでも成立する', () => {
      expect(self('&祝福').addBuffs).toEqual([
        { buffName: '祝福', buffEffect: '', expire: null },
      ]);
    });

    // 両方が数値のときは先に書いた方を R 数として扱う
    it('両方数値なら先が R 数', () => {
      expect(self('&祝福/2/3').addBuffs).toEqual([
        { buffName: '祝福', buffEffect: '3', expire: 2 },
      ]);
    });
  });

  describe('parse - 削除とラウンド操作', () => {
    function self(text: string) { return BuffCommand.parse(text)[0]; }

    it('末尾の - で指定バフを削除する', () => {
      expect(self('&祝福-').removeBuffNames).toEqual(['祝福']);
      expect(self('&祝福-').addBuffs).toEqual([]);
    });

    it('複数のバフを削除できる', () => {
      expect(self('&祝福- &加護-').removeBuffNames).toEqual(['祝福', '加護']);
    });

    // &R- は削除コマンドより先に判定されるので、バフ名 'R' の削除にはならない
    it('&R- は全バフのラウンドを減らす', () => {
      let command = self('&R-');

      expect(command.changeAllRounds).toBe(-1);
      expect(command.removeBuffNames).toEqual([]);
    });

    it('&R+ は全バフのラウンドを増やす', () => {
      expect(self('&R+').changeAllRounds).toBe(1);
    });

    it('繰り返し指定すると積み上がる', () => {
      expect(self('&R- &R- &R-').changeAllRounds).toBe(-3);
      expect(self('&R- &R+').changeAllRounds).toBe(0);
    });

    it('&D で期限切れ削除を立てる', () => {
      expect(self('&D').removeExpired).toBe(true);
    });

    it('大文字小文字を区別しない', () => {
      expect(self('&r-').changeAllRounds).toBe(-1);
      expect(self('&d').removeExpired).toBe(true);
    });
  });

  describe('parse - 対象の指定', () => {
    it('接頭辞なしは自分向け', () => {
      let [selfCommand, targetCommand, allCommand] = BuffCommand.parse('&祝福/3');

      expect(selfCommand).not.toBeNull();
      expect(targetCommand).toBeNull();
      expect(allCommand).toBeNull();
    });

    it('t& はターゲット向け', () => {
      let [selfCommand, targetCommand, allCommand] = BuffCommand.parse('t&祝福/3');

      expect(selfCommand).toBeNull();
      expect(targetCommand.addBuffs.length).toBe(1);
      expect(allCommand).toBeNull();
    });

    it('a& は全体向け', () => {
      let [selfCommand, targetCommand, allCommand] = BuffCommand.parse('a&D');

      expect(selfCommand).toBeNull();
      expect(targetCommand).toBeNull();
      expect(allCommand.removeExpired).toBe(true);
    });

    it('対象ごとに独立して積み上がる', () => {
      let [selfCommand, targetCommand, allCommand] = BuffCommand.parse('&R- t&R- t&R- a&D');

      expect(selfCommand.changeAllRounds).toBe(-1);
      expect(targetCommand.changeAllRounds).toBe(-2);
      expect(allCommand.removeExpired).toBe(true);
    });
  });

  describe('parse - 複数コマンドと非コマンド', () => {
    function self(text: string) { return BuffCommand.parse(text)[0]; }

    it('空白区切りで並べられる', () => {
      expect(self('&祝福/3 &加護/2').addBuffs.map(b => b.buffName)).toEqual(['祝福', '加護']);
    });

    it('空白を挟まず連結しても分解する', () => {
      expect(self('&祝福&加護').addBuffs.map(b => b.buffName)).toEqual(['祝福', '加護']);
    });

    it('追加と削除を混在できる', () => {
      let command = self('&祝福/3 &加護-');

      expect(command.addBuffs.map(b => b.buffName)).toEqual(['祝福']);
      expect(command.removeBuffNames).toEqual(['加護']);
    });

    it('& を含まなければ全て null', () => {
      expect(BuffCommand.parse('ふつうの発言')).toEqual([null, null, null]);
      expect(BuffCommand.parse('')).toEqual([null, null, null]);
    });

    it('& だけでは何も生成しない', () => {
      expect(BuffCommand.parse('&')).toEqual([null, null, null]);
    });

    // 対象の判別はコマンドの中身を見る前に済ませるため、
    // どの書式にも当てはまらない入力では空のコマンドだけが残る
    it('書式に当てはまらない入力では空のコマンドが残る', () => {
      let command = self('&/');

      expect(command).not.toBeNull();
      expect(command.addBuffs).toEqual([]);
      expect(command.removeBuffNames).toEqual([]);
      expect(command.changeAllRounds).toBe(0);
      expect(command.removeExpired).toBe(false);
    });

    it('全角のコマンドを半角として解釈する', () => {
      expect(self('＆祝福／３／命中＋１').addBuffs).toEqual([
        { buffName: '祝福', buffEffect: '命中+1', expire: 3 },
      ]);
    });
  });

  /**
   * make で組み立てた文字列を parse が意図どおり読み戻せることを確認する。
   * 組み立て側の制約は解釈側の文法から導かれているので、この往復が両者の整合を保証する。
   */
  describe('round-trip（make → parse）', () => {
    function self(text: string) { return BuffCommand.parse(text)[0]; }

    it('追加コマンドが意図どおり読まれる', () => {
      expect(self(BuffCommand.makeAdd({ name: '祝福', round: 3, effect: '命中+1' })).addBuffs).toEqual([
        { buffName: '祝福', buffEffect: '命中+1', expire: 3 },
      ]);
    });

    it('R数のみ・効果のみ・どちらも無しが区別される', () => {
      expect(self(BuffCommand.makeAdd({ name: '祝福', round: 3 })).addBuffs)
        .toEqual([{ buffName: '祝福', buffEffect: '', expire: 3 }]);
      expect(self(BuffCommand.makeAdd({ name: '祝福', effect: '命中+1' })).addBuffs)
        .toEqual([{ buffName: '祝福', buffEffect: '命中+1', expire: null }]);
      expect(self(BuffCommand.makeAdd({ name: '祝福' })).addBuffs)
        .toEqual([{ buffName: '祝福', buffEffect: '', expire: null }]);
    });

    it('R数 0 が無制限と取り違えられない', () => {
      expect(self(BuffCommand.makeAdd({ name: '祝福', round: 0 })).addBuffs)
        .toEqual([{ buffName: '祝福', buffEffect: '', expire: 0 }]);
    });

    // 解釈側は先に来た数値を R 数と見なすため、効果が数字だけでも取り違えられないこと
    it('数値だけの効果は R 数と併記しても順序が保たれる', () => {
      expect(self(BuffCommand.makeAdd({ name: '祝福', round: 2, effect: '3' })).addBuffs)
        .toEqual([{ buffName: '祝福', buffEffect: '3', expire: 2 }]);
    });

    it('削除コマンドが追加と取り違えられない', () => {
      let command = self(BuffCommand.makeRemove('祝福'));

      expect(command.removeBuffNames).toEqual(['祝福']);
      expect(command.addBuffs).toEqual([]);
    });

    it('ラウンド操作が削除と取り違えられない', () => {
      let decrease = self(BuffCommand.makeChangeRound(-1));

      expect(decrease.changeAllRounds).toBe(-1);
      expect(decrease.removeBuffNames).toEqual([]);
      expect(self(BuffCommand.makeChangeRound(1)).changeAllRounds).toBe(1);
    });

    it('ラウンド進行は減少と期限切れ削除の両方になる', () => {
      let command = self(BuffCommand.makeProgressRound());

      expect(command.changeAllRounds).toBe(-1);
      expect(command.removeExpired).toBe(true);
    });

    it('対象の指定が保たれる', () => {
      expect(BuffCommand.parse(BuffCommand.makeAdd({ name: '祝福', target: 'self' }))[0]).not.toBeNull();
      expect(BuffCommand.parse(BuffCommand.makeAdd({ name: '祝福', target: 'target' }))[1]).not.toBeNull();
      expect(BuffCommand.parse(BuffCommand.makeAdd({ name: '祝福', target: 'all' }))[2]).not.toBeNull();
    });
  });

  describe('parse - 行全体からの抽出', () => {
    // 行全体に正規表現を当てているので、地の文を挟んでも取りこぼさない
    it('地の文を挟んだ複数コマンドを拾う', () => {
      let [selfCommand, targetCommand] = BuffCommand.parse('&祝福/2 斬りつけた t&毒/3');

      expect(selfCommand.addBuffs.length).toBe(1);
      expect(targetCommand.addBuffs.length).toBe(1);
      expect(selfCommand.addBuffs[0].buffName).toBe('祝福');
      expect(targetCommand.addBuffs[0].buffName).toBe('毒');
    });

    it('改行で区切られていても拾う', () => {
      let [selfCommand, targetCommand] = BuffCommand.parse('&祝福/2\nt&毒/3');

      expect(selfCommand.addBuffs.length).toBe(1);
      expect(targetCommand.addBuffs.length).toBe(1);
    });
  });
});
