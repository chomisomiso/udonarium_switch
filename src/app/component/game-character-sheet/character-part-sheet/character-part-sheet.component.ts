import { Component, Input } from '@angular/core';

import { CharacterPart } from '@udonarium/character-part/character-part';
import { CharacterPartEditor } from '@udonarium/character-part/character-part-editor';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';

/** キャラクターシートに出す多部位コマの部位。部位の追加・削除もここで受け持つ */
@Component({
  selector: 'character-part-sheet',
  templateUrl: './character-part-sheet.component.html',
  styleUrls: ['./character-part-sheet.component.css']
})
export class CharacterPartSheetComponent {
  @Input() character: GameCharacter = null;
  @Input() isEdit: boolean = false;

  /** 単部位コマなら空 */
  get parts(): CharacterPart[] { return this.character ? this.character.parts : []; }

  addPart() {
    if (!this.character) return;
    CharacterPartEditor.addPart(this.character);
  }

  get addPartTitle(): string {
    return this.parts.length < 1
      ? 'リソースを複製して、2部位のコマにします'
      : '先頭の部位を複製します';
  }

  /** 消すと単部位コマに戻るときだけ説明を出す */
  get removePartTitle(): string {
    switch (this.parts.length) {
      case 1: return '単部位コマにします';
      case 2: return 'もう一方の部位のデータを残して単部位コマにします';
      default: return '';
    }
  }

  /** 最後の部位はコマへ戻るだけなので聞かない。それ以外は部位のデータが消える */
  removePart(part: CharacterPart) {
    let message = `部位「${part.partName}」を削除しますか？`;
    if (this.parts.length === 2) message += '\n残る部位はコマへ戻り、単部位コマになります';
    if (1 < this.parts.length && !confirm(message)) return;
    CharacterPartEditor.removePart(part);
  }

  addPartDataElement(part: CharacterPart) {
    let root = part.dataElement;
    if (!root) return;
    let title = DataElement.create('見出し', '', {});
    title.appendChild(DataElement.create('タグ', '', {}));
    root.appendChild(title);
  }

  trackByIdentifier(index: number, item: CharacterPart): string {
    return item.identifier;
  }
}
