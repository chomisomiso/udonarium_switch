import { ChatMessage } from './chat-message';
import { ChatCommandHandler, ResultMessageContext } from './chat-command-handler';
import { ObjectStore } from './core/synchronize-object/object-store';
import { StringUtil } from './core/system/util/string-util';
import { GameCharacter } from './game-character';

interface BuffCommand {
  addBuffs: BuffInfo[];
  removeBuffNames: string[];
  changeAllRounds: number;
  removeExpired: boolean;
}

interface BuffInfo {
  buffName: string;
  buffEffect: string;
  expire: number | null;
}

export class BuffCommandHandler extends ChatCommandHandler {

  private readonly EMPTY_COMMAND: BuffCommand = { addBuffs: [], removeBuffNames: [], changeAllRounds: 0, removeExpired: false };
  
  async processMessage(chatMessage: ChatMessage, tabIdentifier: string) {
    const INIT_TEXT = 'バフ操作：\n';
    let text = INIT_TEXT;

    let [selfCommand, targetCommand, allCommand] = this.extractCommand(chatMessage.text);

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

  private extractCommand(text: string): [selfBuffCommand: BuffCommand | null, targetBuffCommand: BuffCommand | null, allBuffCommand: BuffCommand | null] {
    let selfBuffCommand: BuffCommand | null = null;
    let targetBuffCommand: BuffCommand | null = null;
    let allBuffCommand: BuffCommand | null = null;

    const commandRegAdd: RegExp = /^[ta]?&([^\/]+)(?:\/([^\/]+))?(?:\/([^\/]+))?/i;  // &バフ名/R数/効果 or &バフ名/効果/R数  バフを追加(後ろ2つは省略可能・順不同)
    const commandRegRemove: RegExp = /^[ta]?&([^\/]+)\-$/i; // &バフ名-  指定バフを削除
    const commandRegDecreaseAll: RegExp = /^[ta]?&R\-$/i; // &R- 自分のバフすべてのラウンドを-1する
    const commandRegIncreaseAll: RegExp = /^[ta]?&R\+$/i; // &R+ 自分のバフすべてのラウンドを+1する
    const commandRegDeleteExpired: RegExp = /^[ta]?&D$/i; // &D  0R以下のバフを消去する  a&で全体対象



    let checkTexts: string[] = StringUtil.toHalfWidth(text).trim().split(/\s+/);
    
    for (let t of checkTexts) {
      let regArray = t.match((/[ta]?&[^&]+/ig));
      if (!regArray) continue;

      for (let c of regArray) {
        let commandTarget: BuffCommand;
        if (/^a/i.test(c)) {
          if (!allBuffCommand) allBuffCommand = { addBuffs: [], removeBuffNames: [], changeAllRounds: 0, removeExpired: false };
          commandTarget = allBuffCommand;
        } else if (/^t/i.test(c)) {
          if (!targetBuffCommand) targetBuffCommand = { addBuffs: [], removeBuffNames: [], changeAllRounds: 0, removeExpired: false };
          commandTarget = targetBuffCommand;
        } else {
          if (!selfBuffCommand) selfBuffCommand = { addBuffs: [], removeBuffNames: [], changeAllRounds: 0, removeExpired: false };
          commandTarget = selfBuffCommand;
        }
        if (commandRegDecreaseAll.test(c)) {
          commandTarget.changeAllRounds -= 1;
        } else if (commandRegIncreaseAll.test(c)) {
          commandTarget.changeAllRounds += 1;
        } else if (commandRegDeleteExpired.test(c)) {
          commandTarget.removeExpired = true;
        } else if (commandRegRemove.test(c)) {
          commandTarget.removeBuffNames.push(c.match(commandRegRemove)[1]);
        } else if (commandRegAdd.test(c)) {
          let res = c.match(commandRegAdd);
          let buffName = res[1];
          let part1 = res[2] || '';
          let part2 = res[3] || '';
          // 数値のみの部分をR数、それ以外を効果として振り分け（両方数値なら先がR数）
          let expire: number | null;
          let buffEffect: string;
          if (/^\d+$/.test(part1)) {
            expire = parseInt(part1);
            buffEffect = part2;
          } else if (/^\d+$/.test(part2)) {
            expire = parseInt(part2);
            buffEffect = part1;
          } else {
            expire = null;
            buffEffect = part1;
          }
          commandTarget.addBuffs.push({ buffName: buffName, buffEffect: buffEffect, expire: expire });
        } else {
          continue;
        }
      }
    }
    return [selfBuffCommand, targetBuffCommand, allBuffCommand];
  }

  /***
   * 指定されたコマンド群を実行する
   */
  private executeCommands(command: BuffCommand, characterId: string): string {
    let result: string = '';

    let character = ObjectStore.instance.get<GameCharacter>(characterId);
    if (!(character instanceof GameCharacter)) { console.log('キャラクターが存在しません'); return ''; }

    if (command.changeAllRounds !== 0) {
      character.changeAllBuffRounds(command.changeAllRounds);
      result += ` ラウンド${command.changeAllRounds > 0 ? '+' : ''}${command.changeAllRounds}\n`;
    }
    if (command.removeExpired) {
      let removed = character.removeExpiredBuffs();
      if (removed.length > 0) result += ` 効果時間切れ：${removed.map(b => b.name).join(' ')}\n`;
      else result += ` 効果時間切れ：なし\n`;
    }
    if (command.removeBuffNames.length > 0) {
      result += ` 削除：`;
      for (let buffName of command.removeBuffNames) {
        let success = character.removeBuff(buffName);
        if (success) result += ` ${buffName}`;
      }
      result += `\n`;
    }
    if (command.addBuffs.length > 0) {
      result += ` 追加：`;
      for (let buffInfo of command.addBuffs) {
        character.addBuff(buffInfo.buffName, buffInfo.expire, buffInfo.buffEffect);
        result += ` ${buffInfo.buffName}(R:${buffInfo.expire != null ? buffInfo.expire : '無制限'} 効果:${buffInfo.buffEffect})`;
      }
      result += `\n`;
    }

    console.log(character);
    return result;
  }
}
