import { CharacterPart } from '@udonarium/character-part/character-part';
import { GameCharacter } from '@udonarium/game-character';
import { resetGameObjects } from 'testing/game-object-testing';
import { makeMultiPartCharacter } from 'testing/multi-part-testing';

describe('CharacterPart', () => {
  let character: GameCharacter;
  let upper: CharacterPart;
  let lower: CharacterPart;

  beforeEach(() => {
    character = makeMultiPartCharacter();
    [upper, lower] = character.parts;
  });

  afterEach(resetGameObjects);

  it('表示名はコマ名と部位名', () => {
    expect(upper.label).toBe('ヒブレイザン(上半身)');
  });

  it('持ち主がいなければ部位の要素だけを引く', () => {
    let part = CharacterPart.create('頭部', upper.dataElement.clone());

    expect(part.label).toBe('(頭部)');
    expect(part.findDataElement('HP')).toBe(part.findOwnDataElement('HP'));
    expect(part.findDataElement('弱点')).toBeNull();
    expect(part.variables.getFirstElementByName('name')).toBeNull();
  });

  // rootDataElement は name 属性でルートを拾うので、部位がコマのルートに化けてはならない
  it('コマの rootDataElement を横取りしない', () => {
    expect(character.rootDataElement.name).toBe('character');
  });

  describe('findDataElement', () => {
    it('部位の要素を先に引く', () => {
      expect(upper.findDataElement('HP')).toBe(upper.findOwnDataElement('HP'));
      expect(upper.findDataElement('HP')).not.toBe(lower.findDataElement('HP'));
    });

    it('部位に無ければ持ち主の要素を引く', () => {
      expect(upper.findDataElement('弱点')).toBe(character.findDataElement('弱点'));
      expect(upper.findOwnDataElement('弱点')).toBeNull();
    });

    it('どちらにも無ければ null', () => {
      expect(upper.findDataElement('MP')).toBeNull();
    });
  });

  describe('値の読み書き', () => {
    it('部位のリソースだけを動かす', () => {
      upper.setCurrentDataValue('HP', 10);

      expect(upper.getCurrentDataValue('HP')).toBe(10);
      expect(lower.getCurrentDataValue('HP')).toBe(45);
    });

    it('最大値を読める', () => {
      expect(upper.getMaxDataValue('HP')).toBe(55);
    });

    it('NaN は書き込まない', () => {
      expect(upper.setCurrentDataValue('HP', NaN)).toBe(false);
      expect(upper.getCurrentDataValue('HP')).toBe(50);
    });
  });

  describe('variables', () => {
    it('部位→共有の順に引く', () => {
      let variables = upper.variables;

      expect(variables.getFirstElementByName('防護').value).toBe('8');
      expect(variables.getFirstElementByName('name').value).toBe('ヒブレイザン');
      expect(variables.getFirstElementByName('無い')).toBeNull();
    });
  });

  describe('バフ', () => {
    it('バフの効果は部位の値だけを動かす', () => {
      upper.ensureBuffList().add('かばう', 3, '回避修正+2');

      expect(upper.getCurrentDataValue('回避修正')).toBe(2);
      expect(lower.getCurrentDataValue('回避修正')).toBe(0);
    });

    it('外すと効果を戻す', () => {
      let buffList = upper.ensureBuffList();
      let buff = buffList.add('かばう', 3, '回避修正+2');
      buffList.remove(buff);

      expect(upper.getCurrentDataValue('回避修正')).toBe(0);
    });

    it('入れ物は部位ごとに別', () => {
      upper.ensureBuffList().add('かばう', 3, '');

      expect(upper.buffs.length).toBe(1);
      expect(lower.buffs.length).toBe(0);
      expect(character.buffs.length).toBe(0);
    });
  });

  describe('create', () => {
    it('雛形の名前を部位のルートの名前へ揃える', () => {
      let part = CharacterPart.create('頭部', upper.dataElement.clone());

      expect(part.dataElement).not.toBeNull();
      expect(part.findOwnDataElement('HP')).not.toBeNull();
    });
  });
});
