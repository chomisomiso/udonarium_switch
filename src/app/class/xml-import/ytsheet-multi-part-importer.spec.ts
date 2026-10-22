import { CharacterPart } from '@udonarium/character-part/character-part';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { YtsheetMultiPartImporter } from '@udonarium/xml-import/ytsheet-multi-part-importer';
import { resetGameObjects } from 'testing/game-object-testing';
import { makeMultiPartCharacter, parseCharacter, SINGLE_PART_XML } from 'testing/multi-part-testing';

describe('YtsheetMultiPartImporter', () => {
  afterEach(resetGameObjects);

  function part(character: GameCharacter, name: string): CharacterPart {
    return character.parts.find(part => part.partName === name);
  }

  function groupNames(element: DataElement): string[] {
    return element.children.map(child => (child as DataElement).name);
  }

  // 単部位コマに `部位名:HP` を混ぜて、振り分けの範囲を確かめる
  const PART_HP = '<data type="numberResource" currentValue="30" name="砲塔:HP">30</data>';
  const DETAIL = '<data name="detail">';

  /** SINGLE_PART_XML の一部を差し替える。差し替え元が無いと素通りの spec になるので、先に確かめる */
  function singlePartWith(target: string, replacement: string): GameCharacter {
    expect(SINGLE_PART_XML).toContain(target);
    return parseCharacter(SINGLE_PART_XML.replace(target, replacement));
  }

  describe('多部位コマ', () => {
    let character: GameCharacter;

    beforeEach(() => {
      character = makeMultiPartCharacter();
    });

    it('`部位名:HP` から部位を出現順に作る', () => {
      expect(character.parts.map(part => part.partName)).toEqual(['上半身', '下半身']);
    });

    it('部位の HP は名前から部位名を外し、現在値と最大値を保つ', () => {
      let hp = part(character, '上半身').findOwnDataElement('HP');

      expect(hp.isNumberResource).toBe(true);
      expect(hp.currentValue).toBe('50');
      expect(hp.value).toBe('55');
      expect(part(character, '下半身').getCurrentDataValue('HP')).toBe(45);
    });

    it('部位の要素は元と同じ名前のグループに入る', () => {
      expect(groupNames(part(character, '上半身').dataElement)).toEqual(['リソース', 'バフ・デバフ']);
    });

    it('部位ごとにまとめて書かれた値を分ける', () => {
      expect(part(character, '上半身').findOwnDataElement('防護').value).toBe('8');
      expect(part(character, '下半身').findOwnDataElement('防護').value).toBe('6');
      expect(character.findDataElement('防護')).toBeNull();
    });

    it('部位を名乗らない要素はコマに残る', () => {
      expect(character.findDataElement('弱点').value).toBe('雷属性ダメージ+3点');
      expect(character.findDataElement('特殊能力')).not.toBeNull();
      expect(character.findDataElement('自動').value).toBe('魔動部品(300G/黒白A)');
    });

    it('リソースを含むグループで部位を名乗らない要素は、情報へまわす', () => {
      let info = character.findDataElement('情報');

      expect(groupNames(info)).toEqual(['特殊能力', 'テスト', '弱点']);
      expect(character.findDataElement('リソース')).toBeNull();
      // リソースを含まないグループはそのまま
      expect(character.findDataElement('戦利品')).not.toBeNull();
    });

    it('バフ・デバフは部位ごとに独立した複製になり、コマからは消える', () => {
      let upper = part(character, '上半身');
      let lower = part(character, '下半身');
      upper.setCurrentDataValue('回避修正', 2);

      expect(upper.getCurrentDataValue('回避修正')).toBe(2);
      expect(lower.getCurrentDataValue('回避修正')).toBe(0);
      expect(character.findDataElement('バフ・デバフ')).toBeNull();
    });

    it('取り込み済みのコマには何もしない', () => {
      expect(YtsheetMultiPartImporter.convert(character)).toBe(false);
      expect(character.parts.length).toBe(2);
    });

    it('チャットパレットはコマに残る', () => {
      expect(character.chatPalette).not.toBeNull();
    });
  });

  describe('単部位コマ', () => {
    it('部位を作らず、データも動かさない', () => {
      let character = parseCharacter(SINGLE_PART_XML);
      let before = character.toXml();

      expect(YtsheetMultiPartImporter.convert(character)).toBe(false);
      expect(character.isMultiPart).toBe(false);
      expect(character.toXml()).toBe(before);
    });
  });

  describe('情報グループが無いコマ', () => {
    it('detail の末尾に作って、部位を名乗らない要素をまわす', () => {
      let character = parseCharacter(SINGLE_PART_XML
        .replace('name="HP"', 'name="砲塔:HP"')
        .replace('<data name="情報">', '<data name="資料">'));

      expect(YtsheetMultiPartImporter.convert(character)).toBe(true);
      expect(groupNames(character.detailDataElement)).toEqual(['資料', '情報']);
      expect(groupNames(character.findDataElement('情報'))).toEqual(['防護']);
    });
  });

  describe('グループに入っていない要素', () => {
    it('部位を名乗る要素は、部位の直下に入る', () => {
      let character = singlePartWith(DETAIL, DETAIL + PART_HP);

      expect(YtsheetMultiPartImporter.convert(character)).toBe(true);
      let turret = part(character, '砲塔');
      expect(groupNames(turret.dataElement)).toEqual(['HP', 'バフ・デバフ']);
      expect(turret.findOwnDataElement('HP').currentValue).toBe('30');
    });
  });

  describe('保存と読み込み', () => {
    it('XML に書き出して読み直しても多部位のまま', () => {
      let character = makeMultiPartCharacter();
      part(character, '下半身').setCurrentDataValue('HP', 12);

      let restored = parseCharacter(character.toXml());

      expect(restored.parts.map(part => part.partName)).toEqual(['上半身', '下半身']);
      expect(part(restored, '下半身').getCurrentDataValue('HP')).toBe(12);
      // 取り込み直しても二重に組み替えない
      expect(YtsheetMultiPartImporter.convert(restored)).toBe(false);
    });
  });

  // 振り分けが届くのは detail 直下の葉とグループの直下だけ。その外まで拾うと、HP の入っていない部位ができる
  describe('findPartNames', () => {
    const HP = '<data type="numberResource" currentValue="30" name="HP">30</data>';
    const EVASION = '<data type="numberResource" currentValue="0" name="回避修正">10</data>';

    function partNamesOf(character: GameCharacter): string[] {
      return YtsheetMultiPartImporter.findPartNames(character.detailDataElement);
    }

    it('グループの直下を拾う', () => {
      expect(partNamesOf(singlePartWith(HP, PART_HP))).toEqual(['砲塔']);
    });

    it('detail の直下を拾う', () => {
      expect(partNamesOf(singlePartWith(DETAIL, DETAIL + PART_HP))).toEqual(['砲塔']);
    });

    it('グループの中のグループは見ない', () => {
      expect(partNamesOf(singlePartWith(HP, `<data name="サブ">${PART_HP}</data>`))).toEqual([]);
    });

    it('部位ごとに複製するグループの中は見ない', () => {
      expect(partNamesOf(singlePartWith(EVASION, PART_HP))).toEqual([]);
    });
  });

  describe('splitPrefixedName', () => {
    it('既知の部位名と区切りで始まる名前を分ける', () => {
      expect(YtsheetMultiPartImporter.splitPrefixedName('上半身:HP', ['上半身'])).toEqual({ partName: '上半身', name: 'HP' });
      expect(YtsheetMultiPartImporter.splitPrefixedName('上半身：MP', ['上半身'])).toEqual({ partName: '上半身', name: 'MP' });
    });

    it('部位名だけで項目名が無ければ分けない', () => {
      expect(YtsheetMultiPartImporter.splitPrefixedName('上半身:', ['上半身'])).toBeNull();
    });

    it('未知の部位名なら分けない', () => {
      expect(YtsheetMultiPartImporter.splitPrefixedName('頭部:HP', ['上半身'])).toBeNull();
    });
  });

  describe('splitValueByPart', () => {
    function plain(value: string): DataElement {
      return DataElement.create('防護', value);
    }

    // 呼び出し側は長い順に並べて渡す
    it('前方一致する部位名は長い方を優先する', () => {
      let values = YtsheetMultiPartImporter.splitValueByPart(plain('腕甲3／腕5'), ['腕甲', '腕']);

      expect(Array.from(values.entries())).toEqual([['腕甲', '3'], ['腕', '5']]);
    });

    it('半角の / でも割る', () => {
      let values = YtsheetMultiPartImporter.splitValueByPart(plain('上半身8/下半身6'), ['上半身', '下半身']);

      expect(values.get('下半身')).toBe('6');
    });

    it('部位名で始まらない片が混じれば割らない', () => {
      expect(YtsheetMultiPartImporter.splitValueByPart(plain('上半身8／その他6'), ['上半身', '下半身'])).toBeNull();
    });

    it('URL の / では割らない', () => {
      let url = DataElement.create('URL', 'https://example.com/sheet/?id=0000');

      expect(YtsheetMultiPartImporter.splitValueByPart(url, ['上半身', '下半身'])).toBeNull();
    });

    it('同じ部位が二度出てきたら割らない', () => {
      expect(YtsheetMultiPartImporter.splitValueByPart(plain('上半身8／上半身6'), ['上半身'])).toBeNull();
    });

    it('部位名だけで値が無ければ割らない', () => {
      expect(YtsheetMultiPartImporter.splitValueByPart(plain('上半身／下半身'), ['上半身', '下半身'])).toBeNull();
    });

    it('型付きの要素は割らない', () => {
      let note = DataElement.create('メモ', '上半身8／下半身6', { type: 'note' });

      expect(YtsheetMultiPartImporter.splitValueByPart(note, ['上半身', '下半身'])).toBeNull();
    });
  });
});
