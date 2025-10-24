import { GameSystemInfo } from 'bcdice/lib/bcdice/game_system_list.json';
import GameSystemClass from 'bcdice/lib/game_system';

import BCDiceLoader from './bcdice/bcdice-loader';
import { ChatMessage, ChatMessageContext } from './chat-message';
import { ChatTab } from './chat-tab';
import { SyncObject } from './core/synchronize-object/decorator';
import { GameObject } from './core/synchronize-object/game-object';
import { ObjectStore } from './core/synchronize-object/object-store';
import { EventSystem } from './core/system';
import { PromiseQueue } from './core/system/util/promise-queue';
import { StringUtil } from './core/system/util/string-util';
import { GameCharacter } from './game-character';
import { DataElement } from './data-element';

interface DiceRollResult {
  id: string;
  result: string;
  isSecret: boolean;
}

let loader: BCDiceLoader;
let queue: PromiseQueue = initializeDiceBotQueue();

@SyncObject('dice-bot')
export class DiceBot extends GameObject {
  static diceBotInfos: GameSystemInfo[] = [];

  // GameObject Lifecycle
  onStoreAdded() {
    super.onStoreAdded();
    EventSystem.register(this)
      .on('SEND_MESSAGE', async event => {
        let chatMessage = ObjectStore.instance.get<ChatMessage>(event.data.messageIdentifier);
        if (!chatMessage || !chatMessage.isSendFromSelf || chatMessage.isSystem) return;

        this.runBcdiceCommand(chatMessage);
        this.runResourceCommand(chatMessage);
        
        return;
      });
  }

  // GameObject Lifecycle
  onStoreRemoved() {
    super.onStoreRemoved();
    EventSystem.unregister(this);
  }

  private sendResultMessage(rollResult: DiceRollResult, originalMessage: ChatMessage) {
    let id: string = rollResult.id.split(':')[0];
    let result: string = rollResult.result;
    let isSecret: boolean = rollResult.isSecret;

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

  async runBcdiceCommand(chatMessage: ChatMessage) {
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
      this.sendResultMessage(rollResult, chatMessage);
    } catch (e) {
      console.error(e);
    }
  }
  
  async runResourceCommand(chatMessage: ChatMessage) {
    let text: string = StringUtil.toHalfWidth(chatMessage.text).trim();
    let checkTexts: string[] = text.split(/\s+/);
    let gameType: string = chatMessage.tag;

    // もうクラス切ったほうがいいのでは？

    // chatMessageを評価する
    
    // 自己リソースとターゲットリソースに分ける
    // :MP-3 ... [自己]
    // :HP-3d ... [ターゲットA] 
    // :HP-3d ... [ターゲットB]...

    // diceBotに投げる
    
    // 出力
    
    for (let t of checkTexts) {
      let regArray = t.match(/t?:[^:]+/ig);
      if (!regArray) continue;
      let isTargeting: boolean = /^t.*/ig.test(t);

      console.log((isTargeting ? 'Target Resource' : 'Self Resource') + ': ' + t);

      for (let c of regArray) {
        console.log(c)
        let res = c.match(/t?:([^\+\-\=:]*)([\+\-\=])([^:]+)/);
        let resourceName: string = res[1];
        let resourceOperator: string = res[2];
        let resourceCommand: string = res[3];
        let isCalculation: boolean = !/[^\d\(\)\+\-\*\/\=]/ig.test(resourceCommand);
        if (isCalculation) {
          resourceCommand = 'C(' + resourceCommand + ')';
        }

        let targetCharacters: GameCharacter[];

        if (isTargeting) {
          // TODO: ターゲット指定時の処理
          // ターゲットキャラのオブジェクト取得
          console.log('no target is selected')
        }
        else {
          let speaker = ObjectStore.instance.get<GameCharacter>(chatMessage.speakBy);
          if ((speaker instanceof GameCharacter)) {
            targetCharacters.push(speaker);
          }
          else {
            console.log('キャラクター以外はリソースを持ちません');
            continue;
          }
        }

        for (let character of targetCharacters) {
          let resourceElement: DataElement = character.detailDataElement.getElementsByName('リソース')[0];
          if (!resourceElement) {
            console.log('リソースを持っていません');
            continue;
          }
          let targetResource: DataElement = resourceElement.getElementsByName(resourceName)[0];
          if (!targetResource) {
            console.log('該当リソースを持っていません： ' + resourceName);
            continue;
          }
          try {
            let rollResult = await DiceBot.diceRollAsync(resourceCommand, gameType);
            console.log(rollResult);
            if (!rollResult.result) continue;
  
            this.sendResultMessage(rollResult, chatMessage);
          } catch (e) {
            console.error(e);
          }

        }
      }

    }
    
    
  }
  static async diceRollAsync(message: string, gameType: string): Promise<DiceRollResult> {
    const empty: DiceRollResult = { id: gameType, result: '', isSecret: false };
    try {
      const gameSystem = await DiceBot.loadGameSystemAsync(gameType);
      if (!gameSystem?.COMMAND_PATTERN.test(message)) return empty;

      const result = gameSystem.eval(message);
      if (result) {
        console.log('diceRoll!!!', result.text);
        console.log('isSecret!!!', result.secret);
        return {
          id: gameSystem.ID,
          result: result.text.replace(/\n?(#\d+)\n/ig, '$1 '), // 繰り返しダイスロールは改行表示を短縮する
          isSecret: result.secret,
        };
      }
    } catch (e) {
      console.error(e);
    }
    return empty;
  }

  static async getHelpMessage(gameType: string): Promise<string> {
    try {
      const gameSystem = await DiceBot.loadGameSystemAsync(gameType);
      return gameSystem.HELP_MESSAGE;
    } catch (e) {
      console.error(e);
    }
    return '';
  }

  static async loadGameSystemAsync(gameType: string): Promise<GameSystemClass> {
    return await queue.add(() => {
      const id = this.diceBotInfos.some(info => info.id === gameType) ? gameType : 'DiceBot';
      try {
        return loader.getGameSystemClass(id);
      } catch {
        return loader.dynamicLoad(id);
      }
    });
  }
}

function initializeDiceBotQueue(): PromiseQueue {
  let queue = new PromiseQueue('DiceBotQueue');
  queue.add(async () => {
    loader = new (await import(
      /* webpackChunkName: "lib/bcdice/bcdice-loader" */
      './bcdice/bcdice-loader')
    ).default;
    DiceBot.diceBotInfos = loader.listAvailableGameSystems()
      .sort((a, b) => {
        if (a.sortKey < b.sortKey) return -1;
        if (a.sortKey > b.sortKey) return 1;
        return 0;
      });
  });
  return queue;
}
