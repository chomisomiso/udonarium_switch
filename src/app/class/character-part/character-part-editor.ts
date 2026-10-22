import { Buff } from '../buff';
import { CharacterPart } from './character-part';
import { CharacterUnit } from './character-unit';
import { DataElement } from '../data-element';
import { GameCharacter } from '../game-character';

/** キャラクターの部位操作 */
export namespace CharacterPartEditor {
  /** 既存の部位と重ならない仮の部位名 */
  export function nextPartName(character: GameCharacter): string {
    let names = new Set(character.parts.map(part => part.partName));
    let index = character.parts.length + 1;
    while (names.has(`部位${index}`)) index++;
    return `部位${index}`;
  }

  /**
   * 部位を足す。1 部位だけの多部位コマは作らない。
   * - 単部位コマなら、リソースとリソースを含むグループ、バフコンテナを最初の部位へ切り出してから足す
   * - 足す部位は先頭の部位のデータを複製する。バフは複製せず、バフによる増減は除く
   * @returns 足した部位（単部位コマからなら 2 つ目）
   */
  export function addPart(character: GameCharacter, partName?: string): CharacterPart {
    if (!character.isMultiPart) character.appendChild(splitIntoFirstPart(character, nextPartName(character)));

    let source = character.parts[0];
    let part = character.appendChild(CharacterPart.create(partName ?? nextPartName(character), source.dataElement?.clone()));
    for (let buff of source.buffs) {
      for (let term of Buff.parseEffectTerms(buff.effect)) {
        // 共有の要素を動かしたバフは、複製先には関係しない
        if (!part.findOwnDataElement(term.name)) continue;
        part.setCurrentDataValue(term.name, part.getCurrentDataValue(term.name) - term.delta);
      }
    }
    return part;
  }

  /** 部位を消す。1 部位しか残らないなら、残る部位のデータとバフもコマへ戻して単部位コマにする */
  export function removePart(part: CharacterPart): void {
    let character = CharacterUnit.characterOf(part);
    if (character && character.parts.length <= 2) {
      // 1 部位だけのコマ（取り込みで作られうる）なら、消す部位そのものを戻す
      let last = character.parts.find(other => other !== part) ?? part;
      mergeIntoCharacter(last, character);
      if (last !== part) last.destroy();
    }
    part.destroy();
  }

  /** 単部位コマの部位ごとのデータを、最初の部位として切り出す */
  function splitIntoFirstPart(character: GameCharacter, partName: string): CharacterPart {
    let part = CharacterPart.create(partName);
    let root = part.dataElement;
    let detail = character.detailDataElement;

    for (let element of dataChildren(detail)) {
      if (element.isNumberResource || CharacterPart.holdsResources(element)) {
        root.appendChild(element);
      }
    }

    // バフの効果は移したリソースに乗っているので、入れ物ごと移せば辻褄が合う
    let buffList = character.buffList;
    if (buffList) {
      // コマ由来の識別子のままだと、後でコマに入れ物を作り直したときに衝突する
      let moved = part.ensureBuffList();
      for (let buff of buffList.buffs) moved.appendChild(buff);
      buffList.destroy();
    }
    return part;
  }

  /** splitIntoFirstPart の逆。部位のデータとバフをコマへ戻す */
  function mergeIntoCharacter(part: CharacterPart, character: GameCharacter): void {
    let detail = character.detailDataElement;
    let root = part.dataElement;
    if (detail && root) {
      // 部位→コマの順に引いていた名前が戻した後も同じ要素を引くよう、部位の要素を前に置く
      let head = dataChildren(detail)[0];
      for (let element of dataChildren(root)) {
        let group = 0 < element.children.length
          ? dataChildren(detail).find(child => child.name === element.name && 0 < child.children.length)
          : null;
        if (group) {
          let first = group.children[0];
          for (let child of dataChildren(element)) group.insertBefore(child, first);
          continue;
        }
        // detail が空なら head が無く、末尾に入る
        detail.insertBefore(element, head);
      }
    }

    // 部位化で消したコマの入れ物は識別子に墓標が残っていて作り直せないので、部位の入れ物ごと移す
    let buffList = character.buffList;
    if (!buffList) {
      character.appendChild(part.ensureBuffList());
      return;
    }
    for (let buff of part.buffs) buffList.appendChild(buff);
  }

  function dataChildren(element: DataElement): DataElement[] {
    return element ? element.children.filter((child): child is DataElement => child instanceof DataElement) : [];
  }
}
