import { ChatMessage } from './chat-message';
import { ChatCommandHandler, ResultMessageContext } from './chat-command-handler';
import { ObjectStore } from './core/synchronize-object/object-store';
import { StringUtil } from './core/system/util/string-util';
import { DataElement } from './data-element';
import { GameCharacter } from './game-character';
import { DiceBot } from '@udonarium/dice-bot';

interface ResourceCommand {
  resource: string;
  operator: string;
  command: string;
  isCalculate: boolean;
  enableOptionL: boolean;
  enableOptionZ: boolean;
  enableOptionMax: boolean;
}

interface ResultList {
  text: string;
  id: string;
}

export class ResourceCommandHandler extends ChatCommandHandler {
  
  async processMessage(chatMessage: ChatMessage, tabIdentifier: string) {
    let text = '';
    let id = '';

    let [selfCommands, targetCommands] = this.extractCommand(chatMessage.text);

    let result  = await this.executeCommands(selfCommands, chatMessage.tag, chatMessage.characterId);
    if (result) {
      text += result.text;
      id = result.id.split(':')[0];
    }

    if (targetCommands.length > 0) {
      let targetIdentifiers = chatMessage.targetIdentifiersArray;
      for (let targetIdentifier of targetIdentifiers) {
        let target = ObjectStore.instance.get<GameCharacter>(targetIdentifier);
        if (!(target instanceof GameCharacter)) continue;
        
        result = await this.executeCommands(targetCommands, chatMessage.tag, target.identifier);
        if (result) {
          text += `[${target.name}]\n` + result.text;
          if (id === '') id = result.id.split(':')[0];
        }
      }
    }

    if (text === '') return;

    let context: ResultMessageContext = {
      from: 'System-ResourceEdit',
      tag: `system resourceEdit`,
      result: text,
      name: `${id} : ${chatMessage.name}`,
    };

    this.sendResultMessage(context, chatMessage, tabIdentifier);
  }

  /***
   * チャットメッセージからリソース操作コマンドを抽出する
   * @param text チャットメッセージのテキスト
   * @returns 抽出されたコマンド配列[自己対象コマンド群, 対他対象コマンド群]
   */
  private extractCommand(text: string): [selfResourceCommands: ResourceCommand[], targetResourceCommands: ResourceCommand[]] {
    let selfResourceCommands: ResourceCommand[] = new Array<ResourceCommand>;
    let targetResourceCommands: ResourceCommand[] = new Array<ResourceCommand>;

    let checkTexts: string[] = StringUtil.toHalfWidth(text).trim().split(/\s+/);
    
    for (let t of checkTexts) {
      let regArray = t.match((/t?:[^\+\-\=\>:]+[\+\-\=\>][^:]+/ig));
      if (!regArray) continue;

      for (let c of regArray) {
        let res = c.match(/^(t?):([^\+\-\=\>:]+)([\+\-\=\>])([^:]+)/);
        let isTargeting = res[1] === 't';
        let resource = res[2];
        let operator = res[3];
        let command  = res[4];
        let optionL = /LZ?$/i.test(command);
        let optionZ = /ZL?$/i.test(command);
        let optionMax = /\^$/.test(resource);

        if (optionL || optionZ) command = command.replace(/(L?Z|Z?L)$/i, '');
        if (optionMax) resource = resource.replace(/\^$/, '');
        // 【暫定】数式・ダイス式のみなら (±a +b -c) 別フォーマットを含むなら ±(a +b -c)
        let isCalc: boolean = !/[^d\d\(\)\+\-\*\/]/.test(command);
        if (isCalc) command = (operator=='-' ? '-' : '') + command + '+(1d1-1)';

        if (isTargeting) {
          targetResourceCommands.push({
            resource: resource,
            operator: operator,
            command: command,
            isCalculate: isCalc,
            enableOptionL: optionL,
            enableOptionZ: optionZ,
            enableOptionMax: optionMax,
          });
        } else {
          selfResourceCommands.push({
            resource: resource,
            operator: operator,
            command: command,
            isCalculate: isCalc,
            enableOptionL: optionL,
            enableOptionZ: optionZ,
            enableOptionMax: optionMax,
          });
        }
      }
    }
    return [selfResourceCommands, targetResourceCommands];
  }

  /***
   * 指定されたコマンド群を実行する
   * @param commands コマンド配列
   * @param gameType ダイスボット名
   * @param characterId 操作対象キャラクターのIdentifier
   * @returns [実行結果の文字列, ダイスボットID]
   */
  async executeCommands(commands: ResourceCommand[], gameType: string, characterId: string): Promise<ResultList | null> {
    let resultMessage: string = '';
    let id: string = '';

    let character = ObjectStore.instance.get<GameCharacter>(characterId);
    if (!(character instanceof GameCharacter)) { console.log('キャラクターが存在しません'); return null; }

    for (let command of commands) {
      let res = command.resource;
      let ope = command.operator;
      let optL = command.enableOptionL;
      let optZ = command.enableOptionZ;
      let optMax = command.enableOptionMax;

      let resourceElement: DataElement = character.detailDataElement.getFirstElementByName(res);
      if (!resourceElement) { console.log('該当リソースを持っていません： ' + character.name + ' - ' + command.resource); continue; }
      
      if (ope == '>') {
        if (character.setDataString(res, command.command)) resultMessage += `>${res}: >${command.command}\n`;
        continue;
      }
      
      let val, formula;
      [val, formula, id] = await this.parseRollResult(command.command, gameType);
      if (isNaN(val)) return null;
      
      let isDigit = /^-?\d+$/.test(formula);
      let currentVal = character.getCurrentDataValue(res);
      let maxVal = character.getMaxDataValue(res);
      let oldVal: number;
      let newVal: number;
      let isOverflow = false;
      let isDone = false;

      if (isNaN(maxVal)) optL = optMax = false;
      oldVal = optMax ? maxVal : currentVal;

      switch (ope) {
        case '=':
          optZ = false;
          newVal = val;
          break;
        case '-': 
          if (!command.isCalculate) val *= -1;
        case '+':
          if (optZ) {
            if (ope === '+' && val < 0 || ope === '-' && val > 0) val = 0;
            else optZ = false;
          }
          newVal = oldVal + val;
          break;
        default:
          break;
      }
      if (optMax) {
        if (newVal < 0) newVal = 0;
        if (newVal < currentVal && optL) {
          isOverflow = true;
          optL = false;
        }
      }
      else if (optL) {
        if (newVal < 0) newVal = 0;
        else if (newVal > maxVal) newVal = maxVal;
        else optL = false;
      }
      
      if (optMax) isDone = character.setMaxDataValue(res, newVal);
      else isDone = character.setCurrentDataValue(res, newVal);

      if (!isDone) continue;
      if (isOverflow) isDone = character.setCurrentDataValue(res, newVal);
      if (!isDone) continue;

      // make output message
      resultMessage += `>${optMax?'最大':''}${res}: `;
      if (ope == '=') {
        resultMessage += `${oldVal} > ${newVal}${isDigit?'':'{'+formula+'}'} `;
      } else {
        resultMessage += `${oldVal}${val==0?ope:val>0?'+':''}${val}${isDigit?'':'{'+formula+'}'} > ${newVal} `;
      }
      resultMessage += `${optL?'[値域制限]':''}${optZ?'[0制限]':''}${isOverflow?'['+res+':'+currentVal+' > 最大値]':''}\n`;
    }
    return { text: resultMessage , id: id };
  }

  /***
   * 指定されたコマンドをBCDiceに投げて、結果を解析する
   * @param command コマンド文字列
   * @param gameType ゲーム名
   * @returns [計算結果, 式の文字列, ダイスボットID]
   */
  async parseRollResult(command: string, gameType: string): Promise<[value: number, formula: string, id: string]> {
    let value = NaN;
    let formula = '';
    let id = '';

    try {
      let rollResult = (await DiceBot.diceRollAsync(command , gameType));
      if (!rollResult) {
        return [NaN, '', ''];
      }
      
      if (/\+\(1d1-1\)$/.test(command)) {
        let a = rollResult.result.split(/\s＞\s/);
        value = parseInt(a?.pop());
        formula = a?.pop().replace(/\+\(1\[1\]-1\)$/, '');
      } else {
        // TBD: ダイスボット特有の書式のパースを実施
        let a = rollResult.result.split(/\s＞\s/);
        value = parseInt(a?.pop());
        formula = command;
      }
      id = rollResult.id.split(':')[0];
    } catch (e) {
      console.error(e);
    }
    return [value, formula, id];
  }
}
