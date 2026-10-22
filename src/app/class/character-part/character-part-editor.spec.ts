import { CharacterPartEditor } from '@udonarium/character-part/character-part-editor';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { resetGameObjects } from 'testing/game-object-testing';
import { makeMultiPartCharacter } from 'testing/multi-part-testing';

describe('CharacterPartEditor', () => {
  afterEach(resetGameObjects);

  describe('nextPartName', () => {
    it('既存の部位と重ならない名前を返す', () => {
      let character = makeMultiPartCharacter();
      character.parts[0].partName = '部位3';

      expect(CharacterPartEditor.nextPartName(character)).toBe('部位4');
    });
  });

  describe('単部位コマに部位を足す', () => {
    let character: GameCharacter;

    /** GameCharacter.create は リソース(HP/MP) と バフ・デバフ(回避修正) を持つ */
    beforeEach(() => {
      character = GameCharacter.create('ゴブリン', 1, '');
      character.setCurrentDataValue('HP', 15);
    });

    it('2部位のコマにする。リソースとバフ・デバフは最初の部位へ移す', () => {
      let part = CharacterPartEditor.addPart(character, '胴体');
      let first = character.parts[0];

      expect(character.parts.length).toBe(2);
      expect(character.parts[1]).toBe(part);
      expect(first.findOwnDataElement('HP').currentValue).toBe(15);
      expect(first.findOwnDataElement('MP')).not.toBeNull();
      expect(first.findOwnDataElement('回避修正')).not.toBeNull();
      expect(character.findDataElement('HP')).toBeNull();
      expect(character.findDataElement('バフ・デバフ')).toBeNull();
      // 足した部位は最初の部位の複製
      expect(part.getCurrentDataValue('HP')).toBe(15);
      expect(part.findOwnDataElement('HP')).not.toBe(first.findOwnDataElement('HP'));
    });

    it('名前を指定しなければ 部位1・部位2 にする', () => {
      CharacterPartEditor.addPart(character);

      expect(character.parts.map(part => part.partName)).toEqual(['部位1', '部位2']);
    });

    it('リソースを持たないグループはコマに残す', () => {
      CharacterPartEditor.addPart(character, '胴体');

      expect(character.findDataElement('情報')).not.toBeNull();
      expect(character.findDataElement('器用度')).not.toBeNull();
    });

    it('リソースを含むグループは、リソース以外の項目ごと移す', () => {
      character.findDataElement('リソース').appendChild(DataElement.create('防護', '3'));

      CharacterPartEditor.addPart(character, '胴体');

      expect(character.parts[0].findOwnDataElement('防護').value).toBe('3');
      expect(character.findDataElement('リソース')).toBeNull();
    });

    it('バフは効果ごと最初の部位へ移り、足した部位には乗らない', () => {
      character.ensureBuffList().add('かばう', 3, '回避修正+2');

      let part = CharacterPartEditor.addPart(character, '胴体');
      let first = character.parts[0];

      expect(first.buffs.map(buff => buff.buffName)).toEqual(['かばう']);
      expect(first.getCurrentDataValue('回避修正')).toBe(2);
      expect(part.buffs.length).toBe(0);
      expect(part.getCurrentDataValue('回避修正')).toBe(0);
      expect(character.buffs.length).toBe(0);
      // 外したら移した先の値が戻る
      first.buffList.remove(first.buffs[0]);
      expect(first.getCurrentDataValue('回避修正')).toBe(0);
    });
  });

  describe('多部位コマに部位を足す', () => {
    it('先頭の部位のデータを複製する', () => {
      let character = makeMultiPartCharacter();
      let part = CharacterPartEditor.addPart(character, '頭部');

      expect(character.parts.length).toBe(3);
      expect(part.findOwnDataElement('防護').value).toBe('8');
      expect(part.findOwnDataElement('HP')).not.toBe(character.parts[0].findOwnDataElement('HP'));
    });

    it('複製元のバフで動いた分は戻す', () => {
      let character = makeMultiPartCharacter();
      character.parts[0].ensureBuffList().add('かばう', 3, '回避修正+2 弱点+1');

      let part = CharacterPartEditor.addPart(character, '頭部');

      expect(part.getCurrentDataValue('回避修正')).toBe(0);
      expect(part.buffs.length).toBe(0);
    });
  });

  it('3部位以上なら、消した部位だけがなくなる', () => {
    let character = makeMultiPartCharacter();
    CharacterPartEditor.addPart(character, '頭部');

    CharacterPartEditor.removePart(character.parts[1]);

    expect(character.parts.map(part => part.partName)).toEqual(['上半身', '頭部']);
    // 2部位以上残るならコマには戻さない
    expect(character.findDataElement('HP')).toBeNull();
  });

  describe('2部位のコマから部位を消すと、残る部位をコマへ戻す', () => {
    let character: GameCharacter;

    beforeEach(() => {
      character = GameCharacter.create('ゴブリン', 1, '');
      character.setCurrentDataValue('HP', 15);
    });

    function groupNames(): string[] {
      return character.detailDataElement.children.map(child => (child as DataElement).name);
    }

    it('リソースとバフ・デバフをコマへ戻す', () => {
      CharacterPartEditor.removePart(CharacterPartEditor.addPart(character, '胴体'));

      expect(character.isMultiPart).toBe(false);
      expect(character.getCurrentDataValue('HP')).toBe(15);
      expect(character.findDataElement('回避修正')).not.toBeNull();
      expect(groupNames()).toEqual(['リソース', 'バフ・デバフ', '情報', '能力']);
    });

    it('残る部位のバフは効果ごとコマへ戻る', () => {
      let part = CharacterPartEditor.addPart(character, '胴体');
      character.parts[0].ensureBuffList().add('かばう', 3, '回避修正+2');

      CharacterPartEditor.removePart(part);

      expect(character.buffs.map(buff => buff.buffName)).toEqual(['かばう']);
      expect(character.getCurrentDataValue('回避修正')).toBe(2);
      // 外したら戻した先の値が戻る
      character.buffList.remove(character.buffs[0]);
      expect(character.getCurrentDataValue('回避修正')).toBe(0);
    });

    // 部位化でコマのバフコンテナを消すと、同じ識別子では作り直せない
    it('戻したあともコマにバフを足せる', () => {
      character.ensureBuffList().add('かばう', 3, '回避修正+2');
      CharacterPartEditor.removePart(CharacterPartEditor.addPart(character, '胴体'));

      let buffList = character.ensureBuffList();

      expect(ObjectStore.instance.get(buffList.identifier)).toBe(buffList);
    });

    it('コマに同名のグループがあれば、部位の項目を先頭に足して1つにまとめる', () => {
      let part = CharacterPartEditor.addPart(character, '胴体');
      let shared = character.detailDataElement.appendChild(DataElement.create('リソース', '', {}));
      shared.appendChild(DataElement.create('メモ', ''));

      CharacterPartEditor.removePart(part);

      expect(groupNames().filter(name => name === 'リソース').length).toBe(1);
      expect(character.findDataElement('リソース').children.map(child => (child as DataElement).name)).toEqual(['HP', 'MP', 'メモ']);
    });

    it('取り込んだ多部位コマは、残る部位のデータを戻す', () => {
      character = makeMultiPartCharacter();
      let [upper, lower] = character.parts;
      upper.setCurrentDataValue('HP', 12);

      CharacterPartEditor.removePart(lower);

      expect(character.isMultiPart).toBe(false);
      expect(character.getCurrentDataValue('HP')).toBe(12);
      expect(character.findDataElement('防護').value).toBe('8');
      expect(groupNames()).toEqual(['リソース', 'バフ・デバフ', '情報', '戦利品']);
    });

    // 取り込みでは 1 部位だけのコマもできうる
    it('1部位だけのコマは、消す部位そのものを戻す', () => {
      character = makeMultiPartCharacter();
      character.parts[1].destroy();

      CharacterPartEditor.removePart(character.parts[0]);

      expect(character.isMultiPart).toBe(false);
      expect(character.getCurrentDataValue('HP')).toBe(50);
    });
  });
});
