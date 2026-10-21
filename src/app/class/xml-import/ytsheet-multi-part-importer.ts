import { CharacterPart } from '../character-part/character-part';
import { DataElement } from '../data-element';
import { GameCharacter } from '../game-character';

/** 部位名を拾う手がかり。`上半身:HP` */
const PART_HP_PATTERN = /^(.+?)[:：]HP$/;
/** 部位名と項目名の区切り */
const PART_SEPARATORS = [':', '：'];
/** 部位別の値の区切り。`上半身8／下半身6` */
const VALUE_SEGMENT_SEPARATOR = /[／/]/;
/** リソースを含むグループのうち、部位を名乗らない要素のまわし先 */
const SHARED_GROUP_NAME = '情報';
/** 全部位へ丸ごと複製するグループ。部位を名乗らない修正値を、部位ごとに増減させるため */
const CLONED_GROUP_NAMES: readonly string[] = ['バフ・デバフ'];

/**
 * ゆとシートのコマ出力を多部位コマへ組み替える。
 *
 * ゆとシートは部位を独立したタグにせず、名前（`上半身:HP`）と値（`防護 = 上半身8／下半身6`）に埋め込む。
 * それを部位ごとの CharacterPart へ振り分け、部位を名乗らない要素は共有として持ち主に残す。
 * リソースを含むグループは部位の側にだけ置きたいので、そこに残った要素は情報グループへまわす。
 */
export namespace YtsheetMultiPartImporter {
  /** `部位名:HP` を持つ部位名。出現順・重複なし。振り分けが届かない場所の要素は見ない */
  export function findPartNames(detail: DataElement): string[] {
    let names: string[] = [];
    for (let element of placeableElements(detail)) {
      let match = PART_HP_PATTERN.exec(element.name ?? '');
      if (match && !names.includes(match[1])) names.push(match[1]);
    }
    return names;
  }

  /** 組み替えたら true。部位が見つからない・すでに多部位なら何もしない */
  export function convert(character: GameCharacter): boolean {
    let detail = character.detailDataElement;
    if (!detail || character.isMultiPart) return false;

    let partNames = findPartNames(detail);
    if (partNames.length < 1) return false;

    let parts = new Map<string, CharacterPart>();
    for (let name of partNames) parts.set(name, character.appendChild(CharacterPart.create(name)));
    // 前方一致で取り違えないよう、長い部位名から照合する
    let matchOrder = [...partNames].sort((a, b) => b.length - a.length);

    for (let child of dataChildren(detail)) {
      if (child.children.length < 1) {
        distribute(child, null, parts, matchOrder);
        continue;
      }
      if (CLONED_GROUP_NAMES.includes(child.name)) {
        for (let part of parts.values()) part.dataElement.appendChild(child.clone());
        child.destroy();
        continue;
      }
      // 振り分けるとリソースが抜けるので、先に見ておく
      let holdsResources = CharacterPart.holdsResources(child) && child.name !== SHARED_GROUP_NAME;
      for (let element of dataChildren(child)) distribute(element, child.name, parts, matchOrder);
      if (holdsResources) {
        for (let element of dataChildren(child)) sharedGroupOf(detail).appendChild(element);
      }
      if (dataChildren(child).length < 1) child.destroy();
    }
    return true;
  }

  /** detail 直下の情報グループ。無ければ末尾に作る */
  function sharedGroupOf(detail: DataElement): DataElement {
    for (let child of dataChildren(detail)) {
      if (child.name === SHARED_GROUP_NAME) return child;
    }
    return detail.appendChild(DataElement.create(SHARED_GROUP_NAME, '', {}));
  }

  /** 要素 1 つを部位へ振り分ける。どの部位も名乗らなければ動かさない */
  function distribute(element: DataElement, groupName: string | null, parts: Map<string, CharacterPart>, matchOrder: string[]) {
    let prefixed = splitPrefixedName(element.name ?? '', matchOrder);
    if (prefixed) {
      element.name = prefixed.name;
      groupOf(parts.get(prefixed.partName), groupName).appendChild(element);
      return;
    }

    let values = splitValueByPart(element, matchOrder);
    if (!values) return;
    for (let [partName, value] of values) {
      groupOf(parts.get(partName), groupName).appendChild(DataElement.create(element.name, value, {}));
    }
    element.destroy();
  }

  /** `上半身:HP` → `{ partName: '上半身', name: 'HP' }`。既知の部位名で始まらなければ null */
  export function splitPrefixedName(name: string, partNames: string[]): { partName: string, name: string } | null {
    for (let partName of partNames) {
      for (let separator of PART_SEPARATORS) {
        let prefix = partName + separator;
        if (name.startsWith(prefix) && prefix.length < name.length) return { partName: partName, name: name.slice(prefix.length) };
      }
    }
    return null;
  }

  /**
   * `上半身8／下半身6` 等の要素を部位ごとの値に分割。
   * 区切った全片が既知の部位名で始まるときだけ（URL などの `/` を巻き込まない）。
   * 型付き（リソース・ノート）と子を持つ要素は対象外
   */
  export function splitValueByPart(element: DataElement, partNames: string[]): Map<string, string> | null {
    if (element.type != null || 0 < element.children.length) return null;

    let values = new Map<string, string>();
    for (let segment of String(element.value ?? '').split(VALUE_SEGMENT_SEPARATOR)) {
      let trimmed = segment.trim();
      let partName = partNames.find(name => trimmed.startsWith(name));
      let value = partName != null ? trimmed.slice(partName.length).trim() : '';
      if (partName == null || value.length < 1 || values.has(partName)) return null;
      values.set(partName, value);
    }
    return 0 < values.size ? values : null;
  }

  /** 部位の中の、元と同じ名前のグループ。無ければ作る。グループ外の要素なら部位のルート */
  function groupOf(part: CharacterPart, groupName: string | null): DataElement {
    let root = part.dataElement;
    if (groupName == null) return root;
    for (let child of dataChildren(root)) {
      if (child.name === groupName) return child;
    }
    return root.appendChild(DataElement.create(groupName, '', {}));
  }

  function dataChildren(element: DataElement): DataElement[] {
    return element.children.filter((child): child is DataElement => child instanceof DataElement);
  }

  /** 振り分けの対象になる要素。convert のループと同じく、detail 直下の葉と、複製しないグループの直下だけ */
  function placeableElements(detail: DataElement): DataElement[] {
    return dataChildren(detail).flatMap(child =>
      child.children.length < 1 ? [child]
        : CLONED_GROUP_NAMES.includes(child.name) ? []
        : dataChildren(child));
  }
}
