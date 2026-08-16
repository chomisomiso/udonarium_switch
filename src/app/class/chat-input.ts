import { ObjectStore } from './core/synchronize-object/object-store';
import { EventSystem } from './core/system';
import { PeerContext } from './core/system/network/peer-context';
import { PeerCursor } from './peer-cursor';

/** Angular, DOM 非依存のチャット入力欄ロジック */

/** 秘話先の identifier を実際の peerId へ解決する。全員宛なら null */
function resolveSendToPeerId(sendTo: string): string {
  if (sendTo == null || sendTo.length < 1) return null;
  let object = ObjectStore.instance.get(sendTo);
  if (!(object instanceof PeerCursor)) return null;
  let peer = PeerContext.parse(object.peerId);
  return peer ? peer.peerId : null;
}

/** 入力履歴。Ctrl+↑↓ で辿る */
export class ChatInputHistory {
  private static MAX_HISTORY_NUM = 1000;

  private history: string[] = new Array();
  /** -1 は履歴を辿っていない（＝未入力）状態 */
  private currentIndex: number = -1;

  push(text: string) {
    if (ChatInputHistory.MAX_HISTORY_NUM <= this.history.length) this.history.shift();
    this.history.push(text);
    this.currentIndex = -1;
  }

  /**
   * 履歴を辿って入力欄に入れる文字列を返す。
   * direction が負で過去へ、正で未来へ。端を越えると未入力状態（空文字）に戻る
   */
  move(direction: number): string {
    if (direction < 0 && this.currentIndex < 0) {
      this.currentIndex = this.history.length - 1;
    } else if (direction > 0 && this.currentIndex >= this.history.length - 1) {
      this.currentIndex = -1;
    } else {
      this.currentIndex = this.currentIndex + direction;
    }
    return this.currentIndex < 0 ? '' : this.history[this.currentIndex];
  }
}

/** 「入力中…」通知を 200ms に間引いてピアへ送る */
export class WritingNotifier {
  private interval: NodeJS.Timeout = null;
  private previousLength: number = 0;

  /**
   * 文字が増えたときだけ通知する（消しているだけなら送らない）。
   * sendTo は秘話先の identifier。間引かれた回は解決コストも払わない
   */
  notify(text: string, chatTabIdentifier: string, sendTo: string) {
    if (this.interval === null && this.previousLength <= text.length) {
      EventSystem.call('WRITING_A_MESSAGE', chatTabIdentifier, resolveSendToPeerId(sendTo));
      this.interval = setTimeout(() => {
        this.interval = null;
      }, 200);
    }
    this.previousLength = text.length;
  }

  /** 送信や履歴移動で入力欄を差し替えたあと、長さを同期する */
  sync(length: number) {
    this.previousLength = length;
  }
}
