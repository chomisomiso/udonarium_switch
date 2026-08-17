import { ChatMessage, ChatMessageContext } from './chat-message';
import { ChatTab } from './chat-tab';
import { GameObject } from './core/synchronize-object/game-object';
import { ObjectStore } from './core/synchronize-object/object-store';
import { EventSystem } from './core/system';

export interface ResultMessageContext {
  from: string;
  tag: string;
  result: string;
  name: string;
  /** 発言者にだけ見せる。ひそひそ話の宛先継承より優先する */
  toSelfOnly?: boolean;
}

export abstract class ChatCommandHandler extends GameObject {
  // GameObject Lifecycle
  onStoreAdded() {
    super.onStoreAdded();
    EventSystem.register(this)
      .on('SEND_MESSAGE', async event => {
        let chatMessage = ObjectStore.instance.get<ChatMessage>(event.data.messageIdentifier);
        if (!chatMessage || !chatMessage.isSendFromSelf || chatMessage.isSystem) return;

        await this.processMessage(chatMessage, event.data.tabIdentifier);
        return;
      });
  }

  // GameObject Lifecycle
  onStoreRemoved() {
    super.onStoreRemoved();
    EventSystem.unregister(this);
  }

  abstract processMessage(chatMessage: ChatMessage, tabIdentifier: string): Promise<void>;

  protected sendResultMessage(context: ResultMessageContext, originalMessage: ChatMessage, tabIdentifier: string) {
    let from: string = context.from;
    let result: string = context.result;
    let tag: string = context.tag;
    let name: string = context.name;

    if (result.length < 1) return;

    let diceBotMessage: ChatMessageContext = {
      identifier: '',
      tabIdentifier: tabIdentifier,
      originFrom: originalMessage.from,
      from: from,
      characterId: '',
      timestamp: originalMessage.timestamp + 1,
      imageIdentifier: '',
      tag: tag,
      name: name,
      text: result
    };

    if (context.toSelfOnly) {
      // originFrom が発言者なので、宛先を発言者にするだけで他ピアからは isDisplayable が false になる
      diceBotMessage.to = originalMessage.from;
    } else if (originalMessage.to != null && 0 < originalMessage.to.length) {
      diceBotMessage.to = originalMessage.to;
      if (originalMessage.to.indexOf(originalMessage.from) < 0) {
        diceBotMessage.to += ' ' + originalMessage.from;
      }
    }
    let chatTab = ObjectStore.instance.get<ChatTab>(tabIdentifier);
    if (chatTab) chatTab.addMessage(diceBotMessage);
  }
}