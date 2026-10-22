import { ImportConverter } from '@udonarium/xml-import/import-converter';
import { resetGameObjects } from 'testing/game-object-testing';
import { MULTI_PART_XML, parseCharacter } from 'testing/multi-part-testing';

/** 個々の変換の中身はそれぞれの spec が担当する。ここでは入口からつながっていることだけを見る */
describe('ImportConverter', () => {
  afterEach(resetGameObjects);

  it('キャラクターには多部位コマの組み替えをかける', () => {
    let character = parseCharacter(MULTI_PART_XML);

    ImportConverter.convert(character);

    expect(character.parts.map(part => part.partName)).toEqual(['上半身', '下半身']);
  });
});
