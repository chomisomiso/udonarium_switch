import { ChatMessage } from './chat-message';
import { ChatCommandHandler } from './chat-command-handler';
import { ObjectStore } from './core/synchronize-object/object-store';
import { DataElement } from './data-element';
import { GameCharacter } from './game-character';
import { ResourceCommand } from './resource-command';
import { DiceBot } from '@udonarium/dice-bot';

interface ResultList {
  text: string;
  warnings: string[];
  id: string;
}

/** BCDice へ投げた結果。rawResult が空ならコマンドとして成立しなかった */
interface RollResult {
  /** 算出された数値。数値として読めなければ NaN */
  value: number;
  /** チャットへそのまま流す BCDice の生出力（ダミーダイス除去済み） */
  rawResult: string;
  id: string;
}

/** toDiceExpression が足す `+(1d1-1)`。BCDice の出力には式側 `+(1D1-1)` と出目側 `+(1[1]-1)` の両方が現れる */
const DUMMY_DICE_PATTERN = /\+\(1(?:D1|\[1\])-1\)/gi;

export class ResourceCommandHandler extends ChatCommandHandler {
  
  async processMessage(chatMessage: ChatMessage, tabIdentifier: string) {
    let text = '';
    let warnings: string[] = [];
    let id = '';

    let [selfCommands, targetCommands] = ResourceCommand.parse(chatMessage.text);

    let result  = await this.executeCommands(selfCommands, chatMessage.tag, chatMessage.characterId);
    if (result) {
      text += result.text;
      Array.prototype.push.apply(warnings, result.warnings);
      id = result.id.split(':')[0];
    }

    if (targetCommands.length > 0) {
      let targetIdentifiers = chatMessage.targetIdentifiersArray;
      if (targetIdentifiers.length < 1) warnings.push('ターゲットが未選択です');

      for (let targetIdentifier of targetIdentifiers) {
        let target = ObjectStore.instance.get<GameCharacter>(targetIdentifier);
        if (!(target instanceof GameCharacter)) continue;

        result = await this.executeCommands(targetCommands, chatMessage.tag, target.identifier);
        if (result) {
          // 警告はコマンド自体の不備なのでまとめて落とす
          if (result.text !== '') text += `[${target.name}]\n` + result.text;
          Array.prototype.push.apply(warnings, result.warnings);
          if (id === '') id = result.id.split(':')[0];
        }
      }
    }

    this.sendResultMessage({
      from: 'System-ResourceEdit',
      tag: `system resourceEdit`,
      result: text,
      name: `${id} : ${chatMessage.name}`,
    }, chatMessage, tabIdentifier);

    this.sendResultMessage({
      from: 'System-ResourceEdit',
      tag: `system`,
      result: Array.from(new Set(warnings)).join('\n'),
      name: 'System',
      toSelfOnly: true,
    }, chatMessage, tabIdentifier);
  }

  /***
   * コマンド本体を BCDice へ渡せる式に整える。
   * 数式・ダイス式は必ず式として評価させるため、符号を前置してダミーダイスを足す。
   * parseRollResult はこの `+(1d1-1)` の有無で、生出力からダミーを消すかを決める。
   */
  private toDiceExpression(command: ResourceCommand): string {
    if (!command.isCalculate) return command.command;
    return (command.operator === '-' ? '-' : '') + command.command + '+(1d1-1)';
  }

  /***
   * 指定されたコマンド群を実行する
   * @param commands コマンド配列
   * @param gameType ダイスボット名
   * @param characterId 操作対象キャラクターのIdentifier
   * @returns キャラクターが存在しなければ null
   */
  async executeCommands(commands: ResourceCommand[], gameType: string, characterId: string): Promise<ResultList | null> {
    let resultMessage: string = '';
    let warnings: string[] = [];
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
      
      let roll = await this.parseRollResult(this.toDiceExpression(command), gameType);
      id = roll.id;

      // BCDice がコマンドとして受け付けなかった。破棄して本人に知らせる
      if (roll.rawResult === '') {
        warnings.push(`>${res}: 「${command.command}」を振れませんでした`);
        continue;
      }

      // 数値リテラルは経過を見せる価値がないので生出力行を省く
      let rawResultLine = /^-?\d+$/.test(command.command) ? '' : roll.rawResult + '\n';

      // 式としては妥当だが数値が出ない（`＞ 自動的失敗` 等）。リソースは触らず結果だけ流す
      if (isNaN(roll.value)) {
        resultMessage += rawResultLine + `>${optMax ? '最大' : ''}${res}: 変更なし\n`;
        continue;
      }

      let val = roll.value;
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
      resultMessage += rawResultLine;
      resultMessage += `>${optMax?'最大':''}${res}: `;
      if (ope == '=') {
        resultMessage += `${oldVal} > ${newVal} `;
      } else {
        resultMessage += `${oldVal}${val==0?ope:val>0?'+':''}${val} > ${newVal} `;
      }
      resultMessage += `${optL?'[値域制限]':''}${optZ?'[0制限]':''}${isOverflow?'['+res+':'+currentVal+' > 最大値]':''}\n`;
    }
    return { text: resultMessage, warnings: warnings, id: id };
  }

  /***
   * 指定されたコマンドをBCDiceに投げて、結果を解析する
   * @param command コマンド文字列
   * @param gameType ゲーム名
   */
  async parseRollResult(command: string, gameType: string): Promise<RollResult> {
    let value = NaN;
    let rawResult = '';
    let id = '';

    try {
      let rollResult = await DiceBot.diceRollAsync(command, gameType);

      // toDiceExpression が足したダミーダイスは経過にも残るので、表示前に取り除く
      rawResult = /\+\(1d1-1\)$/.test(command)
        ? rollResult.result.replace(DUMMY_DICE_PATTERN, '')
        : rollResult.result;

      let segments = rawResult.split(/\s＞\s/);
      value = parseInt(segments[segments.length - 1]);
      id = rollResult.id.split(':')[0];
    } catch (e) {
      console.error(e);
    }
    return { value: value, rawResult: rawResult, id: id };
  }
}
