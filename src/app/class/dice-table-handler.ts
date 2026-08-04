import { DiceBot, DiceRollResult } from '@udonarium/dice-bot';
import { ChatCommandHandler, ResultMessageContext } from './chat-command-handler';
import { ChatMessage } from './chat-message';
import { ObjectStore } from './core/synchronize-object/object-store';
import { StringUtil } from './core/system/util/string-util';
import { DiceTable } from './dice-table';

interface DiceTableCommand {
  diceTable: DiceTable;
  modifier: string;
}

export class DiceTableHandler extends ChatCommandHandler {

  // processMessage implementation
  async processMessage(chatMessage: ChatMessage, tabIdentifier: string): Promise<void> {
    let text: string = StringUtil.toHalfWidth(chatMessage.text).trim();
    if (text.length < 1) return;

    let command = this.matchDiceTable(text);
    if (!command) return;

    try {
      let rollText: string = command.diceTable.dice.trim() + command.modifier;
      let rollResult = await DiceBot.diceRollAsync(rollText, command.diceTable.dicebot);
      if (!rollResult.result) {
        this.sendResultMessage(this.makeErrorMessageContext(command.diceTable, rollText), chatMessage, tabIdentifier);
        return;
      }

      let context = this.makeResultMessageContext(command.diceTable, rollResult, chatMessage.name);
      this.sendResultMessage(context, chatMessage, tabIdentifier);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * 発言の先頭からダイス表のコマンドを探し、続きを補正値として解釈する。
   * 補正値区切りの空白が無い場合は `D66` のような発言でコマンド `D` の表が誤爆しないよう符号必須。
   */
  private matchDiceTable(text: string): DiceTableCommand | null {
    let candidates = ObjectStore.instance.getObjects(DiceTable)
      .map(diceTable => ({ diceTable: diceTable, command: StringUtil.toHalfWidth(diceTable.command).trim() }))
      .filter(candidate => 0 < candidate.command.length && text.startsWith(candidate.command))
      .sort((a, b) => b.command.length - a.command.length); // 最長一致を優先する

    for (let candidate of candidates) {
      let rest: string = text.slice(candidate.command.length);
      let isSeparated: boolean = /^\s/.test(rest);

      rest = rest.replace(/\s+/g, '');
      if (rest.length < 1) return { diceTable: candidate.diceTable, modifier: '' };
      if (!isSeparated && !/^[+\-]/.test(rest)) continue;

      let modifier = this.parseModifier(rest);
      if (modifier != null) return { diceTable: candidate.diceTable, modifier: modifier };
    }
    return null;
  }

  /** 補正値の指定を BCDice へ連結できる形に整える。解釈できない場合は null を返す */
  private parseModifier(text: string): string | null {
    let modifier: string = /^[+\-]/.test(text) ? text : '+' + text;
    return /^[+\-][\dDd+\-*/()]+$/.test(modifier) ? modifier : null;
  }

  private makeResultMessageContext(diceTable: DiceTable, rollResult: DiceRollResult, name: string): ResultMessageContext {
    let id: string = rollResult.id.split(':')[0];
    let isSecret: boolean = rollResult.isSecret;

    let lines: string[] = [`【${diceTable.name}】`, rollResult.result];

    let total = this.extractTotal(rollResult.result);
    lines.push((total != null ? diceTable.lookup(total) : null) ?? 'ダイス目の番号が表にありません');

    return {
      from: 'System-BCDice',
      tag: `system dicebot${isSecret ? ' secret' : ''}`,
      result: lines.join('\n'),
      name: `${id} : ${name}${isSecret ? ' (Secret)' : ''}`,
    };
  }

  private makeErrorMessageContext(diceTable: DiceTable, rollText: string): ResultMessageContext {
    return {
      from: 'System-BCDice',
      tag: 'system dicebot',
      result: `【${diceTable.name}】\nダイス「${rollText}」を振れませんでした`,
      name: 'DiceTable',
    };
  }

  /** BCDice の結果文字列から合計値を取り出す。`(2D6+3) ＞ 9[4,5]+3 ＞ 12` の末尾セグメントが合計値 */
  private extractTotal(resultText: string): number | null {
    let lines = resultText.split('\n').filter(line => 0 < line.trim().length);
    let lastLine = lines[lines.length - 1];
    if (lastLine == null) return null;

    let segments = lastLine.split(/[＞→]/);
    let total = this.lastInteger(segments[segments.length - 1]);
    // 成功／失敗などで終わる書式のために、行全体の末尾の整数へフォールバックする
    return total != null ? total : this.lastInteger(lastLine);
  }

  private lastInteger(text: string): number | null {
    let matches = text.match(/-?\d+/g);
    return matches ? Number(matches[matches.length - 1]) : null;
  }
}
