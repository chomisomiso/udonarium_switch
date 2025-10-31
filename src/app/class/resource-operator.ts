import { GameSystemInfo } from 'bcdice/lib/bcdice/game_system_list.json';

import { DiceBot } from './dice-bot';
import { ChatMessage, ChatMessageContext } from './chat-message';
import { ChatTab } from './chat-tab';
import { SyncObject } from './core/synchronize-object/decorator';
import { GameObject } from './core/synchronize-object/game-object';
import { ObjectStore } from './core/synchronize-object/object-store';
import { EventSystem } from './core/system';
import { StringUtil } from './core/system/util/string-util';
import { GameCharacter } from './game-character';
import { DataElement } from './data-element';

interface ResourceCommand {
  resource: string;
  operator: string;
  command: string;
  isCalculate: boolean;
  enableOptionL: boolean;
  enableOptionZ: boolean;
}

@SyncObject('resource-operator')
export class ResourceOperator extends GameObject {
  static diceBotInfos: GameSystemInfo[] = [];

  // GameObject Lifecycle
  onStoreAdded() {
    super.onStoreAdded();
    EventSystem.register(this)
      .on('RESOURCE_EDIT', async event => {
        let chatMessage = ObjectStore.instance.get<ChatMessage>(event.data.messageIdentifier);
        if (!chatMessage || !chatMessage.isSendFromSelf || chatMessage.isSystem) return;

        this.process(chatMessage);

        return;
      });
  }
  // GameObject Lifecycle
  onStoreRemoved() {
    super.onStoreRemoved();
    EventSystem.unregister(this);
  }

  private sendResultMessage(result: string, originalMessage: ChatMessage) {
    let id: string = originalMessage.tag.split(':')[0];
    let isSecret: boolean = originalMessage.isSecret;

    if (result.length < 1) return;

    let diceBotMessage: ChatMessageContext = {
      identifier: '',
      tabIdentifier: originalMessage.tabIdentifier,
      originFrom: originalMessage.from,
      from: 'System-BCDice',
      timestamp: originalMessage.timestamp + 1,
      imageIdentifier: '',
      tag: `system dicebot${isSecret ? ' secret' : ''}`,
      name: `${id} : ${originalMessage.name}${isSecret ? ' (Secret)' : ''}`,
      text: result
    };

    if (originalMessage.to != null && 0 < originalMessage.to.length) {
      diceBotMessage.to = originalMessage.to;
      if (originalMessage.to.indexOf(originalMessage.from) < 0) {
        diceBotMessage.to += ' ' + originalMessage.from;
      }
    }
    let chatTab = ObjectStore.instance.get<ChatTab>(originalMessage.tabIdentifier);
    if (chatTab) chatTab.addMessage(diceBotMessage);
  }
  
  async process(chatMessage: ChatMessage) {
    let commands = this.extractCommand(chatMessage.text);
    let message  = await this.executeCommands(commands, chatMessage.tag, chatMessage.speaker);
    this.sendResultMessage(message, chatMessage);

    return;
  }

  private extractCommand(text: string): ResourceCommand[] {
    let commands: ResourceCommand[] = new Array<ResourceCommand>;

    let checkTexts: string[] = StringUtil.toHalfWidth(text).trim().split(/\s+/);
    
    for (let t of checkTexts) {
      let regArray = t.match((/:[^\+\-\=:]+[\+\-\=][^:]+/ig));
      if (!regArray) continue;

      for (let c of regArray) {
        let res = c.match(/^:([^\+\-\=:]+)([\+\-\=])([^:]+)/);
        let resource = res[1];
        let operator = res[2];
        let command  = res[3];
        let optionL = /LZ?$/i.test(command);
        let optionZ = /ZL?$/i.test(command);

        if (optionL || optionZ) command = command.replace(/(L?Z|Z?L)$/i, '');

        // 数式・ダイス式のみなら (±a +b -c) 別フォーマットを含むなら ±(a +b -c)
        let isCalc: boolean = !/[^d\d\(\)\+\-\*\/]/.test(command);
        if (isCalc) command = (operator=='-' ? '-' : '') + command + '+(1d1-1)';

        commands.push({
          resource: resource,
          operator: operator,
          command: command,
          isCalculate: isCalc,
          enableOptionL: optionL,
          enableOptionZ: optionZ,
        });
      }
    }
    return commands;
  }

  async executeCommands(commands: ResourceCommand[], gameType: string, characterId: string): Promise<string>{
    let result: string = '';

    let character = ObjectStore.instance.get<GameCharacter>(characterId);
    if (!(character instanceof GameCharacter)) { console.log('キャラクターが存在しません'); return result; }
    for (let command of commands) {
      let resourceElement: DataElement = character.detailDataElement.getFirstElementByName(command.resource);
      if (!resourceElement) { console.log('該当リソースを持っていません： ' + character.name + ' - ' + command.resource); continue; }
      if (resourceElement.isNote) { console.log('数値リソースではありません： ' + character.name + ' - ' + command.resource); continue; }

      // resource edit
      let val, calc;
      [val, calc] = await this.parseRollResult(command.command, gameType);
      if (isNaN(val)) return '';

      let res = command.resource;
      let ope = command.operator;
      let optL = command.enableOptionL;
      let optZ = command.enableOptionZ;
      let isDisit = /^-?\d+$/.test(calc);
      let oldVal = character.getCurrentDataValue(res);
      let maxVal = character.getMaxDataValue(res);
      let newVal: number;

      if (isNaN(maxVal)) optL = false;

      switch (ope) {
        case '+':
          if (optZ) {
            if (val < 0) val = 0;
            else optZ = false;
          }
          newVal = oldVal + val;
          break;
        case '-':
          if (!command.isCalculate) val *= -1;
          if (optZ) {
            if (val > 0) val = 0;
            else optZ = false;
          }
          newVal = oldVal + val;
          break;
        case '=':
          optZ = false;
          newVal = val;
          break;
        default:
          break;
      }
      if (optL) {
        if (newVal < 0) newVal = 0;
        else if (newVal > maxVal) newVal = maxVal;
        else optL = false;
      }
      
      character.setCurrentDataValue(command.resource, newVal);
      
      // make output message
      if (ope == '=') {
        result += `>${res}: ${oldVal} > ${newVal}${isDisit?'':'{'+calc+'}'} ${optL?'[値域制限]':''}${optZ?'[0制限]':''}\n`;
      } else {
        result += `>${res}: ${oldVal}${val==0?ope:val>0?'+':''}${val}${isDisit?'':'{'+calc+'}'} > ${newVal} ${optL?'[値域制限]':''}${optZ?'[0制限]':''}\n`;
      }
    }
    return result;
  }

  async parseRollResult(command: string, gameType: string): Promise<[value: number, calc: string]> {
    let value = NaN;
    let calc = '';

    try {
      let result = (await DiceBot.diceRollAsync(command , gameType))?.result;
      if (!result) {
        return [NaN, ''];
      }
      
      if (/\+\(1d1-1\)$/.test(command)) {
        let a = result.split(/\s＞\s/);
        value = parseInt(a?.pop());
        calc = a?.pop().replace(/\+\(1\[1\]-1\)$/, '');
      }
    } catch (e) {
      console.error(e);
    }
    return [value, calc];
  }
}
