import { Injectable } from '@angular/core';

import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { ChatMessage, ChatMessageContext } from '@udonarium/chat-message';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { GameObject } from '@udonarium/core/synchronize-object/game-object';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { Network } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';
import { GameSystemSetting } from '@udonarium/game-system-setting';
import { PeerCursor } from '@udonarium/peer-cursor';

const HOURS = 60 * 60 * 1000;

@Injectable()
export class ChatMessageService {
  private intervalTimer: NodeJS.Timeout = null;
  private timeOffset: number = Date.now();
  private performanceOffset: number = performance.now();

  private ntpApiUrls: string[] = [
    'https://worldtimeapi.org/api/ip',
  ];

  /** ローカル上書き。未設定ならルーム設定（GameSystemSetting）に従う */
  private _gameType: string = null;
  get gameType(): string { return this._gameType || GameSystemSetting.instance.gameType; }
  set gameType(gameType: string) { this._gameType = gameType; }

  constructor() { }

  get chatTabs(): ChatTab[] {
    return ChatTabList.instance.chatTabs;
  }

  calibrateTimeOffset() {
    if (this.intervalTimer != null) {
      console.log('calibrateTimeOffset was canceled.');
      return;
    }
    let index = Math.floor(Math.random() * this.ntpApiUrls.length);
    let ntpApiUrl = this.ntpApiUrls[index];
    let sendTime = performance.now();
    fetch(ntpApiUrl)
      .then(response => {
        if (response.ok) return response.json();
        throw new Error('Network response was not ok.');
      })
      .then(jsonObj => {
        let endTime = performance.now();
        let latency = (endTime - sendTime) / 2;
        let timeobj = jsonObj;
        let st: number = new Date(timeobj.utc_datetime).getTime();
        let fixedTime = st + latency;
        this.timeOffset = fixedTime;
        this.performanceOffset = endTime;
        console.log('latency: ' + latency + 'ms');
        console.log('st: ' + st + '');
        console.log('timeOffset: ' + this.timeOffset);
        console.log('performanceOffset: ' + this.performanceOffset);
        this.setIntervalTimer();
      })
      .catch(error => {
        console.warn('There has been a problem with your fetch operation: ', error.message);
        this.setIntervalTimer();
      });
    this.setIntervalTimer();
  }

  private setIntervalTimer() {
    if (this.intervalTimer != null) clearTimeout(this.intervalTimer);
    this.intervalTimer = setTimeout(() => {
      this.intervalTimer = null;
      this.calibrateTimeOffset();
    }, 6 * HOURS);
  }

  getTime(): number {
    return Math.floor(this.timeOffset + (performance.now() - this.performanceOffset));
  }

  /**
   * @param sendTo ひそひそ話の宛先。宛先を指定しないなら空文字（chat-input が流す既定値と同じ）
   * @param sendFrom 発言者。多部位コマの部位も来る（characterId にそのまま載り、自分向けコマンドの対象になる）
   * @param targets このメッセージが作用するターゲット。
   *   t: / t& のリソース操作はここに載せた全員へ適用される。現在のターゲット選択に
   *   効かせたい呼び出し元は GameCharacterTargetingService.getTargets() を渡すこと。
   */
  sendMessage(chatTab: ChatTab, text: string, gameType: string, sendFrom: string, sendTo: string, targets: Iterable<CharacterUnit>): ChatMessage {
    let targetIdentifiers = Array.from(targets).map(t => t.identifier).join(' ');

    let chatMessage: ChatMessageContext = {
      from: Network.peer.userId,
      to: this.findId(sendTo),
      characterId: sendFrom,
      targetIds: targetIdentifiers,
      name: this.makeMessageName(sendFrom, sendTo),
      imageIdentifier: this.findImageIdentifier(sendFrom),
      imageCrop: this.findImageCrop(sendFrom),
      timestamp: this.calcTimeStamp(chatTab),
      tag: gameType,
      text: text,
    };

    return chatTab.addMessage(chatMessage);
  }

  /** システム発言として、自分にだけ見えるメッセージを送る。 */
  sendSystemMessageToSelf(chatTab: ChatTab, text: string): ChatMessage {
    let userId = Network.peer.userId;
    return chatTab.addMessage({
      from: 'System-ChatPalette',
      originFrom: userId,
      to: userId,
      name: 'System',
      timestamp: this.calcTimeStamp(chatTab),
      tag: 'system',
      text: text,
    });
  }

  private findId(identifier: string): string {
    let object = ObjectStore.instance.get(identifier);
    if (object instanceof GameCharacter) {
      return object.identifier;
    } else if (object instanceof PeerCursor) {
      return object.userId;
    }
    return null;
  }

  private findObjectName(identifier: string): string {
    let unit = CharacterUnit.resolve(identifier);
    if (unit) return CharacterUnit.labelOf(unit);
    let object = ObjectStore.instance.get(identifier);
    if (object instanceof PeerCursor) {
      return object.name;
    }
    return identifier;
  }

  private makeMessageName(sendFrom: string, sendTo?: string): string {
    let sendFromName = this.findObjectName(sendFrom);
    if (sendTo == null || sendTo.length < 1) return sendFromName;

    let sendToName = this.findObjectName(sendTo);
    return sendFromName + ' > ' + sendToName;
  }

  /** 部位の発言は持ち主のコマの画像で出す */
  private findImageIdentifier(identifier: string): string {
    let object: GameObject = CharacterUnit.resolveCharacter(identifier) ?? ObjectStore.instance.get(identifier);
    if (object instanceof GameCharacter) {
      return object.imageFile ? object.imageFile.identifier : '';
    } else if (object instanceof PeerCursor) {
      return object.imageIdentifier;
    }
    return identifier;
  }

  /** 発言時点の表示調整を焼き込む。既定値なら空文字を返し、ChatTab.addMessage が属性ごと省く */
  private findImageCrop(identifier: string): string {
    let object = CharacterUnit.resolveCharacter(identifier);
    return object ? object.imageCrop.toString() : '';
  }

  private calcTimeStamp(chatTab: ChatTab): number {
    let now = this.getTime();
    let latest = chatTab.latestTimeStamp;
    return now <= latest ? latest + 1 : now;
  }
}
