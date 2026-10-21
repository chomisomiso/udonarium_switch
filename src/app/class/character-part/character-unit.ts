import { CharacterPart } from './character-part';
import { VariableSource } from '../chat-palette';
import { ObjectStore } from '../core/synchronize-object/object-store';
import { GameCharacter } from '../game-character';

/**
 * リソース・バフの操作単位。単部位コマはコマそのもの、多部位コマは部位。
 */
export type CharacterUnit = GameCharacter | CharacterPart;

export namespace CharacterUnit {
  /** 多部位コマの本体が自分向けコマンドを打ったときの警告 */
  export const PART_NOT_SELECTED_WARNING = '多部位コマで自分向けのコマンドを使うには、発言する部位を選んでください';

  /** 多部位コマの本体か。どの部位のことか決まらないので、自分向けコマンドの対象にしない */
  export function isMultiPartCharacter(unit: CharacterUnit | null): boolean {
    return unit instanceof GameCharacter && unit.isMultiPart;
  }

  /** identifier から操作単位を取得。コマでも部位でもなければ null */
  export function resolve(identifier: string): CharacterUnit | null {
    if (!identifier) return null;
    let object = ObjectStore.instance.get(identifier);
    return object instanceof GameCharacter || object instanceof CharacterPart ? object : null;
  }

  /** 持ち主のコマ。部位が宙に浮いていれば null */
  export function characterOf(unit: CharacterUnit | null): GameCharacter | null {
    if (unit instanceof CharacterPart) {
      let parent = unit.parent;
      return parent instanceof GameCharacter ? parent : null;
    }
    return unit ?? null;
  }

  /** identifier から持ち主のコマを取得。部位なら持ち主、コマならそのコマ */
  export function resolveCharacter(identifier: string): GameCharacter | null {
    return characterOf(resolve(identifier));
  }

  /** チャットやコマンド結果に出す名前 */
  export function labelOf(unit: CharacterUnit): string {
    return unit instanceof CharacterPart ? unit.label : unit.name;
  }

  export function variablesOf(unit: CharacterUnit): VariableSource {
    return unit instanceof CharacterPart ? unit.variables : unit.rootDataElement;
  }

  /** コマを操作単位へ展開する。多部位なら全部位、単部位ならコマ自身 */
  export function unitsOf(character: GameCharacter): CharacterUnit[] {
    let parts = character.parts;
    return 0 < parts.length ? parts : [character];
  }

  /** コマの代表の操作単位。多部位なら先頭の部位 */
  export function primaryOf(character: GameCharacter): CharacterUnit {
    return unitsOf(character)[0];
  }

  /** コマの中から identifier の操作単位を取得。無ければ代表（多部位なら先頭の部位、単部位ならコマ） */
  export function resolveIn(character: GameCharacter, identifier: string): CharacterUnit {
    return character.parts.find(part => part.identifier === identifier) ?? primaryOf(character);
  }
}
