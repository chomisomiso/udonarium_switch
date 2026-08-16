import { BuffCommand } from './buff-command';
import { ChatMessage } from './chat-message';
import { ChatCommandHandler, ResultMessageContext } from './chat-command-handler';
import { ObjectStore } from './core/synchronize-object/object-store';
import { GameCharacter } from './game-character';

export class BuffCommandHandler extends ChatCommandHandler {

  async processMessage(chatMessage: ChatMessage, tabIdentifier: string) {
    const INIT_TEXT = 'バフ操作：\n';
    let text = INIT_TEXT;

    let [selfCommand, targetCommand, allCommand] = BuffCommand.parse(chatMessage.text);

    if (selfCommand) {
      text += this.executeCommands(selfCommand, chatMessage.characterId);
    }

    if (targetCommand) {
      for (let targetIdentifier of chatMessage.targetIdentifiersArray) {
        let target = ObjectStore.instance.get<GameCharacter>(targetIdentifier);
        if (!(target instanceof GameCharacter)) continue;
        
        text += `[${target.name}]\n` + this.executeCommands(targetCommand, target.identifier);
      }
    }

    if (allCommand) {
      let allCharacters = ObjectStore.instance.getObjects(GameCharacter)
        .filter((obj: GameCharacter) => obj.location.name === 'table' && !obj.isHiddenInInventory);
      for (let character of allCharacters) {
        text += `[${character.name}]\n` + this.executeCommands(allCommand, character.identifier);
      }
    }

    if (text === INIT_TEXT) return;

    let context: ResultMessageContext = {
      from: 'System-BuffEdit',
      tag: `system buffEdit`,
      result: text,
      name: `BuffEdit : ${chatMessage.name}`,
    };

    this.sendResultMessage(context, chatMessage, tabIdentifier);
  }

  /***
   * 指定されたコマンド群を実行する
   */
  private executeCommands(command: BuffCommand, characterId: string): string {
    let result: string = '';

    let character = ObjectStore.instance.get<GameCharacter>(characterId);
    if (!(character instanceof GameCharacter)) { console.log('キャラクターが存在しません'); return ''; }

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
