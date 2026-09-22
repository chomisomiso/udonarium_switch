import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { GameCharacter } from '@udonarium/game-character';
import { GameSystemSetting } from '@udonarium/game-system-setting';
import { SampleCharacter } from '@udonarium/sample-character';
import { resetGameObjects } from 'testing/game-object-testing';

/**
 * サンプルのコマは XML のテキストなので、書き損じてもコンパイラは何も言わない。
 * 属性名の typo は「読めるが効かない」形で静かに壊れるため、ここで見張る
 */
describe('SampleCharacter', () => {
  afterEach(resetGameObjects);

  it('定義した数だけコマを作る', () => {
    let characters = SampleCharacter.createAll();

    expect(characters.length).toBe(SampleCharacter.sources.length);
    expect(characters.every(character => character instanceof GameCharacter)).toBe(true);
  });

  it('名前とサイズが読める', () => {
    for (let character of SampleCharacter.createAll()) {
      expect(character.name.length).toBeGreaterThan(0);
      expect(character.size).toBeGreaterThanOrEqual(1);
    }
  });

  /**
   * numberResource 属性を書き忘れると type が undefined になり、値は見えるのに
   * リソースとして動かなくなる（getMaxDataValue が NaN を返す）。ここで見張るのはそれ。
   *
   * 0 や未定義そのものは異常ではない。MP を持たないキャラクターC、リソースを一切
   * 持たないキャラクターD（データだけ置いておくコマの例）はサンプルとして意図的なもの
   */
  it('HP・MP を持つコマはリソースとして読める', () => {
    let checked = 0;

    for (let character of SampleCharacter.createAll()) {
      for (let name of ['HP', 'MP']) {
        let max = character.getMaxDataValue(name);
        if (max === null) continue;

        expect(max).not.toBeNaN();
        expect(max).toBeGreaterThanOrEqual(0);
        expect(character.getCurrentDataValue(name)).not.toBeNaN();
        expect(character.getCurrentDataValue(name)).toBeGreaterThanOrEqual(0);
        checked++;
      }
    }

    expect(checked).toBeGreaterThan(0);
  });

  it('コマ画像が ImageStorage に登録される', () => {
    for (let character of SampleCharacter.createAll()) {
      let identifier = character.imageFile.identifier;

      expect(identifier).toMatch(/^\.\/assets\/images\//);
      expect(ImageStorage.instance.get(identifier)).not.toBeNull();
    }
  });

  // location.x のような入れ子の属性は、綴りを間違えると既定値の 0 のまま重なって置かれる
  it('テーブル上の位置が数値で入る', () => {
    let locations = SampleCharacter.createAll().map(character => {
      expect(character.isVisibleOnTable).toBe(true);
      expect(character.location.x).toBeGreaterThan(0);
      expect(character.location.y).toBeGreaterThan(0);
      return `${character.location.x},${character.location.y}`;
    });

    expect(new Set(locations).size).toBe(locations.length);
  });

  it('チャットパレットがルーム設定のダイスボットで付く', () => {
    GameSystemSetting.instance.gameType = 'Cthulhu7th';

    for (let character of SampleCharacter.createAll()) {
      expect(character.chatPalette).not.toBeNull();
      expect(character.chatPalette.dicebot).toBe('Cthulhu7th');
    }
  });

  /**
   * 入室すると各ピアが作ったサンプルが同期される。identifier が乱数だと別のコマとして
   * 入室者の数だけ増えるので、子孫まで全ピアで同じ identifier になっている必要がある
   */
  it('コマと子孫の identifier が毎回同じになる', () => {
    let first = SampleCharacter.createAll().map(collectIdentifiers);
    resetGameObjects();
    let second = SampleCharacter.createAll().map(collectIdentifiers);

    expect(second).toEqual(first);
    expect(new Set(first.flat()).size).toBe(first.flat().length);
  });

  it('2 回呼んでもコマは増えない', () => {
    SampleCharacter.createAll();
    SampleCharacter.createAll();

    expect(ObjectStore.instance.getObjects(GameCharacter).length).toBe(SampleCharacter.sources.length);
  });
});

function collectIdentifiers(node: ObjectNode): string[] {
  return [node.identifier].concat(...node.children.map(collectIdentifiers));
}
