import { CharacterPart } from '@udonarium/character-part/character-part';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import {
  calcResourceBarWidth,
  calcResourceMaxValues,
  CharacterTagsSource,
  getCharacter,
  getCharacterDataTags,
  getCharacterOtherDataTags,
  getCharacterResourceTags,
  getPartDataTags,
  getUnitBuffs,
  getUnitDataTags,
  resolveSelection,
} from 'component/game-character-dashboard/character-tags';
import { resetGameObjects } from 'testing/game-object-testing';
import { makeMultiPartCharacter } from 'testing/multi-part-testing';

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

  describe('getUnitBuffs', () => {
    it('コマの持つバフを返す', () => {
      let character = GameCharacter.create('ゴブリン', 1, '');
      character.ensureBuffList().add('加護', 3, 'HP+2');

      let buffs = getUnitBuffs(character.identifier);

      expect(buffs.length).toBe(1);
      expect(buffs[0].buffName).toBe('加護');
    });

    it('バフを持たないコマは空配列', () => {
      let character = GameCharacter.create('ゴブリン', 1, '');

      expect(getUnitBuffs(character.identifier)).toEqual([]);
    });

    it('コマが見つからなければ空配列', () => {
      expect(getUnitBuffs('unknown')).toEqual([]);
    });
  });

  describe('calcResourceMaxValues', () => {
    /** identifier と部位だけ見られるので、テーブル上のコマは作らずに済ませる。部位は下の「多部位コマ」で見る */
    function character(identifier: string): GameCharacter {
      return { identifier, parts: [] } as unknown as GameCharacter;
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

  describe('多部位コマ', () => {
    const DATA_TAGS = ['HP', '/', '防護', '弱点'];

    it('getPartDataTags はタグ設定の順に、改行マーカーを飛ばして引く', () => {
      let upper = makeMultiPartCharacter().parts[0];

      expect(getPartDataTags(DATA_TAGS, upper, false).map(tag => tag.name)).toEqual(['HP', '防護', '弱点']);
    });

    it('getPartDataTags の ownOnly は共有の要素を含めない', () => {
      let upper = makeMultiPartCharacter().parts[0];

      expect(getPartDataTags(DATA_TAGS, upper, true).map(tag => tag.name)).toEqual(['HP', '防護']);
    });

    it('getUnitDataTags は部位なら部位→共有の順に引く', () => {
      let upper = makeMultiPartCharacter().parts[0];
      let source = { ...makeSource({}), dataTags: DATA_TAGS };

      expect(getUnitDataTags(source, upper.identifier)).toEqual(getPartDataTags(DATA_TAGS, upper, false));
    });

    it('getCharacter は部位から持ち主を返す', () => {
      let character = makeMultiPartCharacter();

      expect(getCharacter(character.parts[1].identifier)).toBe(character);
    });

    it('getUnitBuffs は部位のバフを返す', () => {
      let upper = makeMultiPartCharacter().parts[0];
      upper.ensureBuffList().add('かばう', 1, '');

      expect(getUnitBuffs(upper.identifier).map(buff => buff.buffName)).toEqual(['かばう']);
    });

    it('calcResourceMaxValues は部位のリソースも集める', () => {
      let character = makeMultiPartCharacter();
      let source = { ...makeSource({ [character.identifier]: [] }), dataTags: DATA_TAGS };

      expect(calcResourceMaxValues(source, [character])).toEqual({ 'HP': 55 });
    });
  });

  describe('resolveSelection', () => {
    let multi: GameCharacter;
    let goblin: GameCharacter;

    beforeEach(() => {
      multi = makeMultiPartCharacter();
      goblin = GameCharacter.create('ゴブリン', 1, '');
    });

    it('一覧にある選択はそのまま', () => {
      let lower = multi.parts[1];

      expect(resolveSelection([goblin, multi], lower.identifier, multi.identifier)).toBe(lower);
      expect(resolveSelection([goblin, multi], goblin.identifier, goblin.identifier)).toBe(goblin);
    });

    // 削除の通知が届く時点で部位は ObjectStore から消えていて、identifier から持ち主を引けない
    it('選んでいた部位が消えたら、覚えておいた持ち主の先頭の部位', () => {
      let [upper, lower] = multi.parts;
      lower.destroy();

      expect(resolveSelection([goblin, multi], lower.identifier, multi.identifier)).toBe(upper);
    });

    it('部位を全部消して単部位に戻ったら、コマ本体', () => {
      let lower = multi.parts[1];
      multi.parts.forEach(part => part.destroy());

      expect(resolveSelection([goblin, multi], lower.identifier, multi.identifier)).toBe(multi);
    });

    it('本体を選んでいたコマに部位が足されたら、先頭の部位', () => {
      let part = goblin.appendChild(CharacterPart.create('胴体'));

      expect(resolveSelection([goblin, multi], goblin.identifier, goblin.identifier)).toBe(part);
    });

    it('持ち主が一覧に無ければ、一覧の先頭', () => {
      expect(resolveSelection([multi, goblin], '', '')).toBe(multi.parts[0]);
      expect(resolveSelection([multi], goblin.identifier, goblin.identifier)).toBe(multi.parts[0]);
    });

    it('一覧が空なら null', () => {
      expect(resolveSelection([], goblin.identifier, goblin.identifier)).toBeNull();
    });
  });
});
