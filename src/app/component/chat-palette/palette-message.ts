import { BuffCommand } from '@udonarium/buff-command';
import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { ChatTab } from '@udonarium/chat-tab';
import { ResourceCommand } from '@udonarium/resource-command';
import { ChatMessageService } from 'service/chat-message.service';

/** 1通ぶんの発言 */
export interface PaletteMessage {
  text: string;
  /** この発言が作用するターゲット。ChatMessageService.sendMessage の targets へ渡す */
  targets: CharacterUnit[];
}

export interface PaletteMessagePlan {
  /** 送れない理由。自分にだけ見せるシステム発言に載せる */
  warning?: string;
  messages: PaletteMessage[];
}

/** 発言の宛先まわり。chat-input が流す値と同じ形 */
export interface PaletteMessageEnvelope {
  text: string;
  gameType: string;
  sendFrom: string;
  sendTo: string;
}

/**
 * パレットを展開して発言する。
 *
 * @param sender 発言者。パレットを持たない／キャラでないなら null（展開せず素通しする）。
 *   多部位コマの部位なら、パレットは持ち主のもので {名前} は部位→共有の順に探す
 */
export function sendPaletteMessages(
  deps: { chatMessageService: ChatMessageService, chatTab: ChatTab },
  sender: CharacterUnit | null,
  envelope: PaletteMessageEnvelope,
  targets: Iterable<CharacterUnit>
): void {
  let plan = planPaletteMessages(sender, envelope.text, targets);
  if (plan.warning) {
    deps.chatMessageService.sendSystemMessageToSelf(deps.chatTab, plan.warning);
    return;
  }
  for (let message of plan.messages) {
    deps.chatMessageService.sendMessage(
      deps.chatTab, message.text, envelope.gameType, envelope.sendFrom, envelope.sendTo, message.targets);
  }
}

/**
 * 何を何通送るかを決める。副作用を持たないので、送信そのものは sendPaletteMessages が行う。
 *
 * ターゲット参照（t{}）を踏んだ発言は、ターゲットごとに1通へ分ける。
 * ハンドラ側が「抽出コマンド×targetIds」のループで適用するため、
 * 1通に複数ターゲットを載せると t{} の展開結果と掛け算になって多重適用になる。
 */
export function planPaletteMessages(sender: CharacterUnit | null, text: string, targets: Iterable<CharacterUnit>): PaletteMessagePlan {
  let targetList = Array.from(targets);
  let character = CharacterUnit.characterOf(sender);
  let palette = character ? character.chatPalette : null;
  if (!palette) return { messages: [{ text: text, targets: targetList }] };

  let senderVariables = CharacterUnit.variablesOf(sender);
  // ターゲット参照の有無は展開してみないと分からない（パレット変数の中に隠れうる）
  let expansion = palette.expand(text, senderVariables);
  if (!expansion.usedTarget) return { messages: [{ text: expansion.text, targets: targetList }] };

  if (targetList.length < 1) return { warning: 'ターゲットが未選択です', messages: [] };

  return {
    messages: targetList.map((target, index) => {
      let line = palette.evaluate(text, senderVariables, CharacterUnit.variablesOf(target));
      // 自分向けリソース／バフ操作と a&（全体バフ）は1通目にだけ残す
      if (0 < index) line = BuffCommand.stripNonTargetCommands(ResourceCommand.stripNonTargetCommands(line));
      return { text: `${line} [${CharacterUnit.labelOf(target)}]`, targets: [target] };
    })
  };
}
