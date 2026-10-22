import { CharacterPart } from '@udonarium/character-part/character-part';
import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { resetGameObjects } from 'testing/game-object-testing';
import { makeMultiPartCharacter } from 'testing/multi-part-testing';

describe('CharacterUnit', () => {
  afterEach(resetGameObjects);

  let single: GameCharacter;
  let multi: GameCharacter;

  beforeEach(() => {
    single = GameCharacter.create('ゴブリン', 1, '');
    multi = makeMultiPartCharacter();
  });

  describe('resolve', () => {
    it('コマも部位も引ける', () => {
      expect(CharacterUnit.resolve(single.identifier)).toBe(single);
      expect(CharacterUnit.resolve(multi.parts[0].identifier)).toBe(multi.parts[0]);
    });

    it('コマでも部位でもなければ null', () => {
      let element = DataElement.create('HP', 1);
      element.initialize();

      expect(CharacterUnit.resolve(element.identifier)).toBeNull();
      expect(CharacterUnit.resolve('')).toBeNull();
    });
  });

  it('characterOf は部位の持ち主、コマならそのコマ', () => {
    expect(CharacterUnit.characterOf(multi.parts[1])).toBe(multi);
    expect(CharacterUnit.characterOf(single)).toBe(single);
    expect(CharacterUnit.characterOf(null)).toBeNull();
    expect(CharacterUnit.characterOf(CharacterPart.create('頭部'))).toBeNull();
  });

  it('resolveCharacter は identifier から持ち主のコマを引く', () => {
    expect(CharacterUnit.resolveCharacter(multi.parts[1].identifier)).toBe(multi);
    expect(CharacterUnit.resolveCharacter(single.identifier)).toBe(single);
    expect(CharacterUnit.resolveCharacter('')).toBeNull();
  });

  it('labelOf は部位なら部位名を添える', () => {
    expect(CharacterUnit.labelOf(single)).toBe('ゴブリン');
    expect(CharacterUnit.labelOf(multi.parts[1])).toBe('ヒブレイザン(下半身)');
  });

  it('unitsOf は多部位なら全部位、単部位ならコマ自身', () => {
    expect(CharacterUnit.unitsOf(multi)).toEqual(multi.parts);
    expect(CharacterUnit.unitsOf(single)).toEqual([single]);
  });

  it('primaryOf は先頭の部位', () => {
    expect(CharacterUnit.primaryOf(multi)).toBe(multi.parts[0]);
    expect(CharacterUnit.primaryOf(single)).toBe(single);
  });

  describe('resolveIn', () => {
    it('コマの部位を指していればその部位', () => {
      expect(CharacterUnit.resolveIn(multi, multi.parts[1].identifier)).toBe(multi.parts[1]);
    });

    // 消えた部位・別のコマの部位・コマ本体を指していても、発言者として使える操作単位に読み替える
    it('部位を指していなければ先頭の部位', () => {
      expect(CharacterUnit.resolveIn(multi, '')).toBe(multi.parts[0]);
      expect(CharacterUnit.resolveIn(multi, multi.identifier)).toBe(multi.parts[0]);
      expect(CharacterUnit.resolveIn(multi, single.identifier)).toBe(multi.parts[0]);
    });

    it('単部位コマならコマ自身', () => {
      expect(CharacterUnit.resolveIn(single, multi.parts[0].identifier)).toBe(single);
    });
  });
});
