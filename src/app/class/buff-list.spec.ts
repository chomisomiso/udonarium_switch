import { Buff } from '@udonarium/buff';
import { BuffList } from '@udonarium/buff-list';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { resetGameObjects } from 'testing/game-object-testing';

describe('BuffList', () => {
  afterEach(resetGameObjects);

  let character: GameCharacter;
  let buffList: BuffList;

  /**
   * HP 200 / MP 100 を持つコマに空のバフリストを付ける。
   * リソースは新規コマのテンプレの既定値に依存しないよう明示的に立てる
   */
  beforeEach(() => {
    character = GameCharacter.create('テスト', 1, '');
    character.setMaxDataValue('HP', 200);
    character.setCurrentDataValue('HP', 200);
    character.setMaxDataValue('MP', 100);
    character.setCurrentDataValue('MP', 100);
    buffList = new BuffList();
    buffList.initialize();
    character.appendChild(buffList);
  });

  /** 型を持たないプレーンテキストのタグを足す */
  function appendPlainTag(name: string, value: string): void {
    character.detailDataElement.appendChild(DataElement.create(name, value));
  }

  describe('add', () => {
    it('効果に書いた増減をリソースへ入れる', () => {
      buffList.add('加護', 3, 'HP+30');

      expect(character.getCurrentDataValue('HP')).toBe(230);
    });

    it('`,` 区切りで複数のリソースを動かす', () => {
      buffList.add('祝福', null, 'HP+10,MP-3');

      expect(character.getCurrentDataValue('HP')).toBe(210);
      expect(character.getCurrentDataValue('MP')).toBe(97);
    });

    it('`=` `>` による代入は解釈しない', () => {
      buffList.add('呪い', null, 'HP=10');
      buffList.add('刻印', null, 'MP>50');

      expect(character.getCurrentDataValue('HP')).toBe(200);
      expect(character.getCurrentDataValue('MP')).toBe(100);
    });

    it('区切り無しで代入と増減が並んでも増減を拾う', () => {
      buffList.add('混在', null, 'HP=10MP+5');

      expect(character.getCurrentDataValue('HP')).toBe(200);
      expect(character.getCurrentDataValue('MP')).toBe(105);
    });

    it('リソース指定を含まない効果はリソースを動かさない', () => {
      buffList.add('有利', null, '命中判定に有利');

      expect(character.getCurrentDataValue('HP')).toBe(200);
    });

    // 効果は現在値を読んで足し戻すので、読めない対象では NaN が出来上がる
    it('非数値タグを指す効果は値を書き換えない', () => {
      appendPlainTag('弱点等', '炎に弱い');
      buffList.add('呪い', 3, '弱点等+5');

      expect(character.detailDataElement.getFirstElementByName('弱点等').value).toBe('炎に弱い');
    });

    it('リストの子として並ぶ', () => {
      buffList.add('加護', 3, 'HP+30');
      buffList.add('祝福', null, 'MP+10');

      expect(buffList.buffs.map(buff => buff.buffName)).toEqual(['加護', '祝福']);
    });
  });

  describe('remove', () => {
    it('効果を逆向きに戻す', () => {
      let buff = buffList.add('加護', 3, 'HP+30');

      expect(buffList.remove(buff)).toBe(true);
      expect(character.getCurrentDataValue('HP')).toBe(200);
      expect(buffList.buffs).toEqual([]);
    });

    it('既に外れているバフの削除は false', () => {
      let buff = buffList.add('加護', 3, 'HP+30');
      buffList.remove(buff);

      expect(buffList.remove(buff)).toBe(false);
      expect(character.getCurrentDataValue('HP')).toBe(200);
    });

    // 同名バフがあるとき、名前では狙えないほうを消せること
    it('同名バフのうち渡した要素だけを消す', () => {
      buffList.add('毒', 3, 'HP-20');
      let second = buffList.add('毒', 5, 'HP-5');

      buffList.remove(second);

      expect(character.getCurrentDataValue('HP')).toBe(180);
      expect(buffList.buffs.map(buff => buff.rounds)).toEqual([3]);
    });
  });

  describe('removeByName', () => {
    // チャットの `&名前-` は名前しか運べないので、この経路は名前で括った操作になる
    it('同名のバフを全部外して効果を全部戻す', () => {
      buffList.add('加護', 3, 'HP+30');
      buffList.add('加護', null, 'HP+30');
      expect(character.getCurrentDataValue('HP')).toBe(260);

      let removed = buffList.removeByName('加護');

      expect(removed.length).toBe(2);
      expect(character.getCurrentDataValue('HP')).toBe(200);
      expect(buffList.buffs).toEqual([]);
    });

    it('名前の違うバフは残す', () => {
      buffList.add('加護', 3, 'HP+30');
      buffList.add('祝福', null, 'MP+10');

      let removed = buffList.removeByName('加護');

      expect(removed.length).toBe(1);
      expect(buffList.buffs.map(buff => buff.buffName)).toEqual(['祝福']);
      expect(character.getCurrentDataValue('MP')).toBe(110);
    });

    it('無いバフの削除は空配列', () => {
      expect(buffList.removeByName('加護')).toEqual([]);
    });
  });

  describe('removeExpired', () => {
    it('期限切れのバフを消して効果を戻す', () => {
      buffList.add('毒', 0, 'HP-5');

      expect(buffList.removeExpired().length).toBe(1);
      expect(character.getCurrentDataValue('HP')).toBe(200);
    });

    it('残ラウンドのあるバフと無制限のバフは消さない', () => {
      buffList.add('加護', 3, 'HP+30');
      buffList.add('祝福', null, 'MP+10');

      expect(buffList.removeExpired()).toEqual([]);
      expect(buffList.buffs.length).toBe(2);
    });

    // 名前で消していた頃は、同名バフがあると期限切れでないほうが消えて別の効果が巻き戻っていた
    it('同名バフがあっても期限切れの要素だけを消す', () => {
      buffList.add('毒', 3, 'HP-20');
      buffList.add('毒', 0, 'HP-5');
      expect(character.getCurrentDataValue('HP')).toBe(175);

      let removed = buffList.removeExpired();

      expect(removed.length).toBe(1);
      expect(character.getCurrentDataValue('HP')).toBe(180);
      expect(buffList.buffs.map(buff => buff.rounds)).toEqual([3]);
    });
  });

  describe('edit', () => {
    it('名前と残りラウンドを書き換える', () => {
      let buff = buffList.add('加護', 3, 'HP+30');

      expect(buffList.edit(buff, '神の加護', 5, 'HP+30')).toBe(true);
      expect(buff.buffName).toBe('神の加護');
      expect(buff.rounds).toBe(5);
    });

    // 加減算しか解釈しないので、戻して入れ直した結果が差し引きゼロになる
    it('効果を変えない編集ではリソースが動かない', () => {
      let buff = buffList.add('加護', 3, 'HP+30');
      buffList.edit(buff, '神の加護', 5, 'HP+30');

      expect(character.getCurrentDataValue('HP')).toBe(230);
    });

    it('効果を変えると差分だけリソースが動く', () => {
      let buff = buffList.add('加護', 3, 'HP+30');
      buffList.edit(buff, '加護', 3, 'HP+10');

      expect(character.getCurrentDataValue('HP')).toBe(210);
    });

    it('効果を空にすると元へ戻る', () => {
      let buff = buffList.add('加護', 3, 'HP+30');
      buffList.edit(buff, '加護', 3, '');

      expect(character.getCurrentDataValue('HP')).toBe(200);
    });

    it('適用先のリソースを差し替えても双方が辻褄の合う値になる', () => {
      let buff = buffList.add('加護', 3, 'HP+30');
      buffList.edit(buff, '加護', 3, 'MP+30');

      expect(character.getCurrentDataValue('HP')).toBe(200);
      expect(character.getCurrentDataValue('MP')).toBe(130);
    });

    it('ラウンドに null を渡すと無制限になる', () => {
      let buff = buffList.add('加護', 3, 'HP+30');
      buffList.edit(buff, '加護', null, 'HP+30');

      expect(buff.isInfinite).toBe(true);
    });

    // 他のピアが消したバフを編集しても、外れた要素を書き戻さない
    it('リストから外れたバフには何もせず false', () => {
      let buff = buffList.add('加護', 3, 'HP+30');
      buffList.remove(buff);

      expect(buffList.edit(buff, '神の加護', 5, 'HP+50')).toBe(false);
      expect(character.getCurrentDataValue('HP')).toBe(200);
    });

    // 取り違えると別のコマのリソースが動く
    it('別のリストのバフには何もせず false', () => {
      let other = new BuffList();
      other.initialize();
      let buff = other.add('加護', 3, 'HP+30');

      expect(buffList.edit(buff, '加護', 3, 'HP+10')).toBe(false);
      expect(buff.effect).toBe('HP+30');
    });
  });

  describe('changeAllRounds', () => {
    it('残ラウンドを増減する', () => {
      buffList.add('加護', 3, 'HP+30');
      buffList.add('毒', 5, 'HP-5');

      buffList.changeAllRounds(-1);

      expect(buffList.buffs.map(buff => buff.rounds)).toEqual([2, 4]);
    });

    it('無制限のバフは動かさない', () => {
      buffList.add('祝福', null, 'MP+10');

      buffList.changeAllRounds(-1);

      expect(buffList.buffs[0].isInfinite).toBe(true);
    });

    // 0R で期限切れは表現できるので、それより下へは減らない
    it('0R のバフを減らしても 0R のまま', () => {
      buffList.add('毒', 0, 'HP-5');

      buffList.changeAllRounds(-1);

      expect(buffList.buffs[0].rounds).toBe(0);
    });

    it('リソースは動かさない', () => {
      buffList.add('加護', 3, 'HP+30');

      buffList.changeAllRounds(-1);

      expect(character.getCurrentDataValue('HP')).toBe(230);
    });
  });

  // ルームやコマの保存・読み込みはこの往復。落ちるとセッション中のバフが消える
  describe('XML の往復', () => {
    it('バフを子ごと復元する', () => {
      buffList.add('加護', 3, 'HP+30');
      buffList.add('祝福', null, 'MP+10');

      let restored = buffList.clone();

      expect(restored.buffs.map(buff => buff.buffName)).toEqual(['加護', '祝福']);
      expect(restored.buffs.map(buff => buff.rounds)).toEqual([3, null]);
      expect(restored.buffs.map(buff => buff.effect)).toEqual(['HP+30', 'MP+10']);
    });

    it('コマごと往復してもバフがぶら下がったまま', () => {
      buffList.add('加護', 3, 'HP+30');

      let restored = character.clone();

      expect(restored.buffs.map(buff => buff.buffName)).toEqual(['加護']);
    });

    // 復元したバフを操作しても、元のコマのリソースを巻き込まない
    it('復元したリストは元のコマのリソースを動かさない', () => {
      buffList.add('加護', 3, 'HP+30');
      let restored = character.clone();

      restored.buffList.remove(restored.buffs[0]);

      expect(character.getCurrentDataValue('HP')).toBe(230);
      expect(restored.getCurrentDataValue('HP')).toBe(200);
    });
  });

  describe('効果の適用先', () => {
    // リストだけが単独で存在する状態でも、リソース操作で落ちない
    it('コマにぶら下がっていなければ効果を適用しない', () => {
      let orphan = new BuffList();
      orphan.initialize();

      expect(() => orphan.add('加護', 3, 'HP+30')).not.toThrow();
      expect(orphan.buffs.length).toBe(1);
    });
  });
});
