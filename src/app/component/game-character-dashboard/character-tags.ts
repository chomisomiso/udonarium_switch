import { Buff } from '@udonarium/buff';
import { CharacterPart } from '@udonarium/character-part/character-part';
import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';

/**
 * コマの DataElement タグをダッシュボード向けに取り出す。
 */

export interface CharacterTagsSource {
  readonly tableInventory: { dataElementMap: Map<string, DataElement[]> };
  readonly newLineDataElement: DataElement;
  /** タグ設定の並び。部位のタグはインベントリが引かないので、これを見て部位から直接引く */
  readonly dataTags?: string[];
}

/** タグ設定の改行マーカー（GameObjectInventoryService の newLineString） */
const NEW_LINE_TAG = '/';

export function getCharacterDataTags(source: CharacterTagsSource, identifier: string): DataElement[] {
  if (!identifier) return [];
  let tags = source.tableInventory.dataElementMap.get(identifier);
  // 改行マーカーはモック要素なのでタグとしては扱わない
  return tags ? tags.filter(tag => tag != null && tag !== source.newLineDataElement) : [];
}

export function getCharacterResourceTags(source: CharacterTagsSource, identifier: string): DataElement[] {
  return filterResourceTags(getCharacterDataTags(source, identifier));
}

export function getCharacterOtherDataTags(source: CharacterTagsSource, identifier: string): DataElement[] {
  return filterOtherDataTags(getCharacterDataTags(source, identifier));
}

export function filterResourceTags(tags: DataElement[]): DataElement[] {
  return tags.filter(tag => tag.isNumberResource);
}

export function filterOtherDataTags(tags: DataElement[]): DataElement[] {
  // 子を持つノード（例: 「バフ・デバフ」）は game-data-element と同じく自身の値を編集させないので表示しない
  return tags.filter(tag => !tag.isNumberResource && tag.children.length < 1);
}

/**
 * 部位のタグをタグ設定の順に引く。
 * @param ownOnly 部位自身の要素だけにする（カードの部位行。共有ぶんは共有行に一度だけ出す）
 */
export function getPartDataTags(dataTags: readonly string[], part: CharacterPart, ownOnly: boolean): DataElement[] {
  let tags: DataElement[] = [];
  for (let name of dataTags) {
    if (name === NEW_LINE_TAG) continue;
    let tag = ownOnly ? part.findOwnDataElement(name) : part.findDataElement(name);
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** 操作単位のタグ。部位なら部位→共有の順に引く */
export function getUnitDataTags(source: CharacterTagsSource, identifier: string): DataElement[] {
  let unit = CharacterUnit.resolve(identifier);
  if (unit instanceof CharacterPart) return getPartDataTags(source.dataTags ?? [], unit, false);
  return getCharacterDataTags(source, identifier);
}

/** identifier のコマ。部位なら持ち主のコマ。コマ以外を指しているなら null */
export function getCharacter(identifier: string): GameCharacter | null {
  return CharacterUnit.resolveCharacter(identifier);
}

/**
 * 選択を一覧に合わせて直す。選んでいたコマが一覧にあれば、その中の操作単位（消えた部位なら先頭の部位）。
 * 部位が消えた後は identifier から持ち主を引けないので、覚えておいた持ち主も見る。持ち主も一覧に無ければ一覧の先頭
 */
export function resolveSelection(characters: GameCharacter[], selectedIdentifier: string, lastCharacterIdentifier: string): CharacterUnit | null {
  let character = getCharacter(selectedIdentifier) ?? getCharacter(lastCharacterIdentifier);
  if (character && characters.includes(character)) return CharacterUnit.resolveIn(character, selectedIdentifier);
  return 0 < characters.length ? CharacterUnit.primaryOf(characters[0]) : null;
}

/** バフはデータ要素ではないので ObjectStore から辿る */
export function getUnitBuffs(identifier: string): Buff[] {
  let unit = CharacterUnit.resolve(identifier);
  return unit ? unit.buffs : [];
}

/** 同名リソースの最大値を、渡されたコマ（の部位）全体から集める。数値でない value は無視する */
export function calcResourceMaxValues(source: CharacterTagsSource, characters: GameCharacter[]): { [resourceName: string]: number } {
  const resourceMaxMap: { [resourceName: string]: number } = {};
  const collect = (tag: DataElement) => {
    // value は string|number なので明示変換する。数値でなければ無視
    let max = +tag.value;
    if (Number.isNaN(max)) return;
    resourceMaxMap[tag.name] = Math.max(resourceMaxMap[tag.name] || 0, max);
  };
  characters.forEach(character => {
    getCharacterResourceTags(source, character.identifier).forEach(collect);
    for (let part of character.parts) {
      filterResourceTags(getPartDataTags(source.dataTags ?? [], part, true)).forEach(collect);
    }
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
