import { Buff } from '@udonarium/buff';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';

/**
 * コマの DataElement タグをダッシュボード向けに取り出す。
 * 候補はタグ設定由来なので、buff-edit が別ディレクトリからこれを引くのは意図的
 */

export interface CharacterTagsSource {
  readonly tableInventory: { dataElementMap: Map<string, DataElement[]> };
  readonly newLineDataElement: DataElement;
}

export function getCharacterDataTags(source: CharacterTagsSource, identifier: string): DataElement[] {
  if (!identifier) return [];
  let tags = source.tableInventory.dataElementMap.get(identifier);
  // 改行マーカーはモック要素なのでタグとしては扱わない
  return tags ? tags.filter(tag => tag != null && tag !== source.newLineDataElement) : [];
}

export function getCharacterResourceTags(source: CharacterTagsSource, identifier: string): DataElement[] {
  return getCharacterDataTags(source, identifier).filter(tag => tag.isNumberResource);
}

export function getCharacterOtherDataTags(source: CharacterTagsSource, identifier: string): DataElement[] {
  // 子を持つノード（例: 「バフ・デバフ」）は game-data-element と同じく自身の値を編集させないので表示しない
  return getCharacterDataTags(source, identifier).filter(tag => !tag.isNumberResource && tag.children.length < 1);
}

export function getCharacter(identifier: string): GameCharacter | null {
  let object = ObjectStore.instance.get(identifier);
  return object instanceof GameCharacter ? object : null;
}

/** バフはデータ要素ではないので ObjectStore から辿る */
export function getCharacterBuffs(identifier: string): Buff[] {
  let character = getCharacter(identifier);
  return character ? character.buffs : [];
}

/** 同名リソースの最大値を、渡されたコマ全体から集める。数値でない value は無視する */
export function calcResourceMaxValues(source: CharacterTagsSource, characters: GameCharacter[]): { [resourceName: string]: number } {
  const resourceMaxMap: { [resourceName: string]: number } = {};
  characters.forEach(character => {
    getCharacterResourceTags(source, character.identifier).forEach(tag => {
      // value は string|number なので明示変換する。数値でなければ無視
      let max = +tag.value;
      if (Number.isNaN(max)) return;
      resourceMaxMap[tag.name] = Math.max(resourceMaxMap[tag.name] || 0, max);
    });
  });
  return resourceMaxMap;
}

/** リソースバーの幅。同名リソースを持つ全コマ中の最大値を 100% とした割合で返す */
export function calcResourceBarWidth(tag: DataElement, maxValues: { [resourceName: string]: number }): string {
  let max = +tag.value;
  let scale = maxValues[tag.name];
  if (Number.isNaN(max) || !scale) return '100%';
  return (max / scale) * 100 + '%';
}
