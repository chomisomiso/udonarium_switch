import { ChatInputHistory, WritingNotifier } from '@udonarium/chat-input';
import { EventSystem } from '@udonarium/core/system';
import { PeerCursor } from '@udonarium/peer-cursor';
import { resetGameObjects } from 'testing/game-object-testing';

describe('ChatInputHistory', () => {

  /** 古い順に積む */
  function historyOf(...texts: string[]): ChatInputHistory {
    let history = new ChatInputHistory();
    texts.forEach(text => history.push(text));
    return history;
  }

  describe('move', () => {
    it('履歴が空なら、どちらへ動かしても未入力のまま', () => {
      let history = new ChatInputHistory();
      expect(history.move(-1)).toBe('');
      expect(history.move(1)).toBe('');
    });

    it('未入力から遡ると最新へ、続けると古い方へ進む', () => {
      let history = historyOf('a', 'b', 'c');
      expect(history.move(-1)).toBe('c');
      expect(history.move(-1)).toBe('b');
      expect(history.move(-1)).toBe('a');
    });

    it('最古を通り越すと未入力に戻り、もう一度遡ると最新へ一周する', () => {
      let history = historyOf('a', 'b', 'c');
      history.move(-1);
      history.move(-1);
      history.move(-1);
      expect(history.move(-1)).toBe('');
      expect(history.move(-1)).toBe('c');
    });

    it('未入力から進めると最古から、最新を通り越すと未入力に戻る', () => {
      let history = historyOf('a', 'b', 'c');
      expect(history.move(1)).toBe('a');
      expect(history.move(1)).toBe('b');
      expect(history.move(1)).toBe('c');
      expect(history.move(1)).toBe('');
    });
  });

  describe('push', () => {
    it('積むと辿っていた位置は未入力に戻る', () => {
      let history = historyOf('a', 'b');
      history.move(-1);
      history.move(-1);
      history.push('c');
      expect(history.move(-1)).toBe('c');
    });

    it('上限を超えると古い方から捨てる', () => {
      // 上限は 1000。1001 件積むと先頭の '0' だけが押し出される
      let history = new ChatInputHistory();
      for (let i = 0; i <= 1000; i++) history.push(String(i));

      let oldest = '';
      for (let i = 0; i < 1000; i++) oldest = history.move(-1);
      expect(oldest).toBe('1');
      expect(history.move(-1)).toBe('');
    });
  });
});

describe('WritingNotifier', () => {
  const TAB = 'chat-tab-identifier';

  let notifier: WritingNotifier;
  /** EventSystem.call() は Network のループバック経由で非同期なので、送信内容は spy で見る */
  let call: jasmine.Spy;

  beforeEach(() => {
    notifier = new WritingNotifier();
    call = spyOn(EventSystem, 'call');
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    resetGameObjects();
  });

  describe('間引き', () => {
    it('入力が始まると通知する', () => {
      notifier.notify('a', TAB, '');
      expect(call).toHaveBeenCalledOnceWith('WRITING_A_MESSAGE', TAB, null);
    });

    it('200ms 以内の連続入力は間引く', () => {
      notifier.notify('a', TAB, '');
      jasmine.clock().tick(199);
      notifier.notify('ab', TAB, '');

      expect(call).toHaveBeenCalledTimes(1);
    });

    it('200ms 経てば再び通知する', () => {
      notifier.notify('a', TAB, '');
      jasmine.clock().tick(200);
      notifier.notify('ab', TAB, '');

      expect(call).toHaveBeenCalledTimes(2);
    });
  });

  describe('文字数による抑制', () => {
    it('消しているだけなら通知しない', () => {
      notifier.notify('ab', TAB, '');
      jasmine.clock().tick(200);
      notifier.notify('a', TAB, '');

      expect(call).toHaveBeenCalledTimes(1);
    });

    // IME の変換確定など、長さが変わらない操作は「入力中」として扱う
    it('長さが変わらないなら通知する', () => {
      notifier.notify('ab', TAB, '');
      jasmine.clock().tick(200);
      notifier.notify('AB', TAB, '');

      expect(call).toHaveBeenCalledTimes(2);
    });

    it('sync() で長さを合わせると、それ以下の入力では通知しない', () => {
      notifier.sync(5);
      notifier.notify('abc', TAB, '');

      expect(call).not.toHaveBeenCalled();
    });

    it('送信後の sync(0) なら、次の1文字目から通知する', () => {
      notifier.notify('hello', TAB, '');
      notifier.sync(0);
      jasmine.clock().tick(200);
      notifier.notify('h', TAB, '');

      expect(call).toHaveBeenCalledTimes(2);
    });
  });

  describe('秘話先の解決', () => {
    /** 直近の通知の宛先（EventSystem.call の第3引数） */
    function lastSendTo(): string {
      return call.calls.mostRecent().args[2];
    }

    it('全員宛なら宛先なしで送る', () => {
      notifier.notify('a', TAB, '');
      expect(lastSendTo()).toBeNull();
    });

    it('PeerCursor の identifier は peerId へ解決する', () => {
      let cursor = new PeerCursor();
      cursor.peerId = 'zzz999';
      cursor.initialize();
      call.calls.reset();

      notifier.notify('a', TAB, cursor.identifier);

      expect(lastSendTo()).toBe('zzz999');
    });

    it('宛先が見つからなければ全員宛に落とす', () => {
      notifier.notify('a', TAB, 'no-such-object');
      expect(lastSendTo()).toBeNull();
    });
  });
});
