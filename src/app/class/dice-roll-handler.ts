import { ChatMessage } from './chat-message';
import { StringUtil } from './core/system/util/string-util';
import { DiceBot, DiceRollResult } from '@udonarium/dice-bot';
import { ChatCommandHandler, ResultMessageContext } from './chat-command-handler';

export class DiceRollHandler extends ChatCommandHandler {

  // processMessage implementation
  async processMessage(chatMessage: ChatMessage, tabIdentifier: string): Promise<void> {
    let text: string = StringUtil.toHalfWidth(chatMessage.text).trim();
    let gameType: string = chatMessage.tag;

    try {
      let regArray = /^((\d+)?\s+)?(.*)?/ig.exec(text);
      let repeat: number = (regArray[2] != null) ? Number(regArray[2]) : 1;
      let rollText: string = (regArray[3] != null) ? regArray[3] : text;
      if (!rollText || repeat < 1) return;
      // 繰り返しコマンドに変換
      if (repeat > 1) {
        rollText = `x${repeat} ${rollText}`
      }

      let rollResult = await DiceBot.diceRollAsync(rollText, gameType);
      if (!rollResult.result) return;
      let context = this.makeResultMessageContext(rollResult, chatMessage.name)
      this.sendResultMessage(context, chatMessage, tabIdentifier);
    } catch (e) {
      console.error(e);
    }
  }
  private makeResultMessageContext(rollResult: DiceRollResult, name: string): ResultMessageContext {
    let id: string = rollResult.id.split(':')[0];
    let result: string = rollResult.result;
    let isSecret: boolean = rollResult.isSecret;

    return {
      from: 'System-BCDice',
      tag: `system dicebot${isSecret ? ' secret' : ''}`,
      result: result,
      name: `${id} : ${name}${isSecret ? ' (Secret)' : ''}`,
    };
  }
}
