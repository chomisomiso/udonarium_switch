import { BuffCommandHandler } from '@udonarium/buff-command-handler';
import { resetGameObjects } from 'testing/game-object-testing';

/**
 * バフ操作コマンドの文法解釈だけを検証する。
 * 実際のバフ付与は GameCharacter のデータ要素を伴うため、ここでは扱わない。
 */
describe('BuffCommandHandler', () => {
  let handler: BuffCommandHandler;

  beforeEach(() => {
    handler = new BuffCommandHandler();
  });

  afterEach(resetGameObjects);

  function extractCommand(text: string): [any, any, any] {
    return (handler as any).extractCommand(text);
  }

  function self(text: string): any {
    return extractCommand(text)[0];
  }

  describe('バフの追加', () => {
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

  describe('バフの削除', () => {
    it('末尾の - で指定バフを削除する', () => {
      expect(self('&祝福-').removeBuffNames).toEqual(['祝福']);
      expect(self('&祝福-').addBuffs).toEqual([]);
    });

    it('複数のバフを削除できる', () => {
      expect(self('&祝福- &加護-').removeBuffNames).toEqual(['祝福', '加護']);
    });
  });

  describe('ラウンド操作', () => {
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

    it('大文字小文字を区別しない', () => {
      expect(self('&r-').changeAllRounds).toBe(-1);
    });
  });

  describe('期限切れの削除', () => {
    it('&D で期限切れ削除を立てる', () => {
      expect(self('&D').removeExpired).toBe(true);
    });

    it('&d でも同じ', () => {
      expect(self('&d').removeExpired).toBe(true);
    });
  });

  describe('対象の指定', () => {
    it('接頭辞なしは自分向け', () => {
      let [selfCommand, targetCommand, allCommand] = extractCommand('&祝福/3');

      expect(selfCommand).not.toBeNull();
      expect(targetCommand).toBeNull();
      expect(allCommand).toBeNull();
    });

    it('t& はターゲット向け', () => {
      let [selfCommand, targetCommand, allCommand] = extractCommand('t&祝福/3');

      expect(selfCommand).toBeNull();
      expect(targetCommand.addBuffs.length).toBe(1);
      expect(allCommand).toBeNull();
    });

    it('a& は全体向け', () => {
      let [selfCommand, targetCommand, allCommand] = extractCommand('a&D');

      expect(selfCommand).toBeNull();
      expect(targetCommand).toBeNull();
      expect(allCommand.removeExpired).toBe(true);
    });

    it('対象ごとに独立して積み上がる', () => {
      let [selfCommand, targetCommand, allCommand] = extractCommand('&R- t&R- t&R- a&D');

      expect(selfCommand.changeAllRounds).toBe(-1);
      expect(targetCommand.changeAllRounds).toBe(-2);
      expect(allCommand.removeExpired).toBe(true);
    });
  });

  describe('複数コマンド', () => {
    it('空白区切りで並べられる', () => {
      let command = self('&祝福/3 &加護/2');

      expect(command.addBuffs.map(b => b.buffName)).toEqual(['祝福', '加護']);
    });

    it('空白を挟まず連結しても分解する', () => {
      let command = self('&祝福&加護');

      expect(command.addBuffs.map(b => b.buffName)).toEqual(['祝福', '加護']);
    });

    it('追加と削除を混在できる', () => {
      let command = self('&祝福/3 &加護-');

      expect(command.addBuffs.map(b => b.buffName)).toEqual(['祝福']);
      expect(command.removeBuffNames).toEqual(['加護']);
    });
  });

  describe('コマンドでない入力', () => {
    it('& を含まなければ全て null', () => {
      expect(extractCommand('ふつうの発言')).toEqual([null, null, null]);
      expect(extractCommand('')).toEqual([null, null, null]);
    });

    it('& だけでは何も生成しない', () => {
      expect(extractCommand('&')).toEqual([null, null, null]);
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
  });

  describe('全角入力', () => {
    it('全角のコマンドを半角として解釈する', () => {
      let command = self('＆祝福／３／命中＋１');

      expect(command.addBuffs).toEqual([
        { buffName: '祝福', buffEffect: '命中+1', expire: 3 },
      ]);
    });
  });
});
