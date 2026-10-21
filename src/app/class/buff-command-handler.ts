import { BuffCommand } from './buff-command';
import { CharacterUnit } from './character-part/character-unit';
import { ChatMessage } from './chat-message';
import { ChatCommandHandler, ResultMessageContext } from './chat-command-handler';
import { ObjectStore } from './core/synchronize-object/object-store';
import { GameCharacter } from './game-character';

export class BuffCommandHandler extends ChatCommandHandler {

  async processMessage(chatMessage: ChatMessage, tabIdentifier: string) {
    const INIT_TEXT = 'バフ操作：\n';
    let text = INIT_TEXT;
    let warnings: string[] = [];

    let [selfCommand, targetCommand, allCommand] = BuffCommand.parse(chatMessage.text);

    if (selfCommand && CharacterUnit.isMultiPartCharacter(CharacterUnit.resolve(chatMessage.characterId))) {
      warnings.push(CharacterUnit.PART_NOT_SELECTED_WARNING);
    } else if (selfCommand) {
      text += this.executeCommands(selfCommand, chatMessage.characterId);
    }

    if (targetCommand) {
      let targetIdentifiers = chatMessage.targetIdentifiersArray;
      if (targetIdentifiers.length < 1) warnings.push('ターゲットが未選択です');

      for (let targetIdentifier of targetIdentifiers) {
        let target = CharacterUnit.resolve(targetIdentifier);
        if (!target) continue;

        text += `[${CharacterUnit.labelOf(target)}]\n` + this.executeCommands(targetCommand, target.identifier);
      }
    }

    if (allCommand) {
      let allCharacters = ObjectStore.instance.getObjects(GameCharacter)
        .filter((obj: GameCharacter) => obj.isVisibleInInventory);
      // 多部位コマは部位ごとにバフを持つ
      for (let unit of allCharacters.flatMap(character => CharacterUnit.unitsOf(character))) {
        text += `[${CharacterUnit.labelOf(unit)}]\n` + this.executeCommands(allCommand, unit.identifier);
      }
    }

    if (text !== INIT_TEXT) {
      this.sendResultMessage({
        from: 'System-BuffEdit',
        tag: `system buffEdit`,
        result: text,
        name: `BuffEdit : ${chatMessage.name}`
      }, chatMessage, tabIdentifier);
    }

    this.sendResultMessage({
      from: 'System-BuffEdit',
      tag: `system`,
      result: warnings.join('\n'),
      name: 'System',
      toSelfOnly: true,
    }, chatMessage, tabIdentifier);
  }

  /***
   * 指定されたコマンド群を実行する
   */
  private executeCommands(command: BuffCommand, characterId: string): string {
    let result: string = '';

    let character = CharacterUnit.resolve(characterId);
    if (!character) { console.log('キャラクターが存在しません'); return ''; }

    if (command.changeAllRounds !== 0) {
      character.buffList?.changeAllRounds(command.changeAllRounds);
      result += ` ラウンド${command.changeAllRounds > 0 ? '+' : ''}${command.changeAllRounds}\n`;
    }
    if (command.removeExpired) {
      let removed = character.buffList?.removeExpired() ?? [];
      if (removed.length > 0) result += ` 効果時間切れ：${removed.map(b => b.buffName).join(' ')}\n`;
      else result += ` 効果時間切れ：なし\n`;
    }
    if (command.removeBuffNames.length > 0) {
      result += ` 削除：`;
      for (let buffName of command.removeBuffNames) {
        let removed = character.buffList?.removeByName(buffName) ?? [];
        if (removed.length > 0) result += ` ${buffName}${removed.length > 1 ? `x${removed.length}` : ''}`;
      }
      result += `\n`;
    }
    if (command.addBuffs.length > 0) {
      result += ` 追加：`;
      for (let buffInfo of command.addBuffs) {
        character.ensureBuffList().add(buffInfo.buffName, buffInfo.expire, buffInfo.buffEffect);
        result += ` ${buffInfo.buffName}(R:${buffInfo.expire != null ? buffInfo.expire : '無制限'} 効果:${buffInfo.buffEffect})`;
      }
      result += `\n`;
    }

    console.log(character);
    return result;
  }
}
