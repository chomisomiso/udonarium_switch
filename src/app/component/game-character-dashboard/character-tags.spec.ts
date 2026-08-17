import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import {
  calcResourceBarWidth,
  calcResourceMaxValues,
  CharacterTagsSource,
  getCharacterBuffs,
  getCharacterDataTags,
  getCharacterOtherDataTags,
  getCharacterResourceTags,
} from 'component/game-character-dashboard/character-tags';
import { resetGameObjects } from 'testing/game-object-testing';

describe('character-tags', () => {
  afterEach(resetGameObjects);

  /** 改行マーカーの代役。GameObjectInventoryService が配る実物と同じく、同一性だけで判定される */
  let newLine: DataElement;

  beforeEach(() => {
    newLine = DataElement.create('/');
  });

  function resource(name: string, max: number | string, current: number | string = 0): DataElement {
    return DataElement.create(name, max, { type: 'numberResource', currentValue: String(current) });
  }

  function plain(name: string, value: number | string = ''): DataElement {
    return DataElement.create(name, value);
  }

  function makeSource(map: { [identifier: string]: DataElement[] }): CharacterTagsSource {
    return {
      tableInventory: { dataElementMap: new Map(Object.entries(map)) },
      newLineDataElement: newLine,
    };
  }

  describe('getCharacterDataTags', () => {
    it('identifier が空なら空配列', () => {
      let source = makeSource({ 'chara': [plain('HP')] });

      expect(getCharacterDataTags(source, '')).toEqual([]);
    });

    it('map に無い identifier なら空配列', () => {
      let source = makeSource({ 'chara': [plain('HP')] });

      expect(getCharacterDataTags(source, 'unknown')).toEqual([]);
    });

    it('改行マーカーを除く', () => {
      let hp = plain('HP');
      let mp = plain('MP');
      let source = makeSource({ 'chara': [hp, newLine, mp] });

      expect(getCharacterDataTags(source, 'chara')).toEqual([hp, mp]);
    });

    it('タグ未設定ぶんの null を除く', () => {
      // dataElementMap はタグ名で引いた結果をそのまま並べるので、持っていないタグは null になる
      let hp = plain('HP');
      let source = makeSource({ 'chara': [hp, null] });

      expect(getCharacterDataTags(source, 'chara')).toEqual([hp]);
    });
  });

  describe('getCharacterResourceTags', () => {
    it('numberResource だけを残す', () => {
      let hp = resource('HP', 20);
      let source = makeSource({ 'chara': [hp, plain('種族', 'エルフ'), newLine] });

      expect(getCharacterResourceTags(source, 'chara')).toEqual([hp]);
    });
  });

  describe('getCharacterOtherDataTags', () => {
    it('numberResource を除く', () => {
      let race = plain('種族', 'エルフ');
      let source = makeSource({ 'chara': [resource('HP', 20), race] });

      expect(getCharacterOtherDataTags(source, 'chara')).toEqual([race]);
    });

    it('子を持つノードを除く', () => {
      // 「バフ・デバフ」のような入れ物は自身の値を編集させないので出さない
      let race = plain('種族', 'エルフ');
      let container = plain('バフ・デバフ');
      container.appendChild(plain('加護'));
      let source = makeSource({ 'chara': [race, container] });

      expect(getCharacterOtherDataTags(source, 'chara')).toEqual([race]);
    });
  });

  describe('getCharacterBuffs', () => {
    it('コマの持つバフを返す', () => {
      let character = GameCharacter.create('ゴブリン', 1, '');
      character.ensureBuffList().add('加護', 3, 'HP+2');

      let buffs = getCharacterBuffs(character.identifier);

      expect(buffs.length).toBe(1);
      expect(buffs[0].buffName).toBe('加護');
    });

    it('バフを持たないコマは空配列', () => {
      let character = GameCharacter.create('ゴブリン', 1, '');

      expect(getCharacterBuffs(character.identifier)).toEqual([]);
    });

    it('コマが見つからなければ空配列', () => {
      expect(getCharacterBuffs('unknown')).toEqual([]);
    });
  });

  describe('calcResourceMaxValues', () => {
    /** identifier だけ見られるので、テーブル上のコマは作らずに済ませる */
    function character(identifier: string): GameCharacter {
      return { identifier } as GameCharacter;
    }

    it('同名リソースは全コマ中の最大値を採る', () => {
      let source = makeSource({
        'a': [resource('HP', 20)],
        'b': [resource('HP', 35)],
        'c': [resource('HP', 12)],
      });

      expect(calcResourceMaxValues(source, [character('a'), character('b'), character('c')]))
        .toEqual({ 'HP': 35 });
    });

    it('リソースごとに別々に集計する', () => {
      let source = makeSource({
        'a': [resource('HP', 20), resource('MP', 8)],
        'b': [resource('HP', 35)],
      });

      expect(calcResourceMaxValues(source, [character('a'), character('b')]))
        .toEqual({ 'HP': 35, 'MP': 8 });
    });

    it('数値でない最大値は無視する', () => {
      let source = makeSource({
        'a': [resource('HP', '不明')],
        'b': [resource('HP', 12)],
      });

      expect(calcResourceMaxValues(source, [character('a'), character('b')]))
        .toEqual({ 'HP': 12 });
    });

    it('数値でない最大値しかなければ、そのリソースは載らない', () => {
      let source = makeSource({ 'a': [resource('HP', '不明')] });

      expect(calcResourceMaxValues(source, [character('a')])).toEqual({});
    });

    it('numberResource でないタグは数えない', () => {
      let source = makeSource({ 'a': [plain('HP', 20)] });

      expect(calcResourceMaxValues(source, [character('a')])).toEqual({});
    });
  });

  describe('calcResourceBarWidth', () => {
    it('最大値に対する割合を返す', () => {
      expect(calcResourceBarWidth(resource('HP', 20), { 'HP': 40 })).toBe('50%');
    });

    it('自分が最大なら 100%', () => {
      expect(calcResourceBarWidth(resource('HP', 40), { 'HP': 40 })).toBe('100%');
    });

    it('最大値が数値でなければ 100%', () => {
      expect(calcResourceBarWidth(resource('HP', '不明'), { 'HP': 40 })).toBe('100%');
    });

    it('スケールが未登録なら 100%', () => {
      expect(calcResourceBarWidth(resource('HP', 20), {})).toBe('100%');
    });

    it('スケールが 0 なら 100%（0 除算を避ける）', () => {
      expect(calcResourceBarWidth(resource('HP', 20), { 'HP': 0 })).toBe('100%');
    });
  });
});
