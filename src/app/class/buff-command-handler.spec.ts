import { BuffCommandHandler } from '@udonarium/buff-command-handler';
import { ChatMessage } from '@udonarium/chat-message';
import { ChatTab } from '@udonarium/chat-tab';
import { GameCharacter } from '@udonarium/game-character';
import { resetGameObjects } from 'testing/game-object-testing';

/**
 * コマンドの文法は buff-command.spec.ts が担当する。
 * ここでは発言を受けてからチャットへ投稿するまでの経路だけを見る。
 */
describe('BuffCommandHandler', () => {
  let handler: BuffCommandHandler;
  let chatTab: ChatTab;

  const SENDER = 'bob';

  beforeEach(() => {
    handler = new BuffCommandHandler();
    chatTab = new ChatTab();
    chatTab.initialize();
  });

  afterEach(resetGameObjects);

  function makeMessage(text: string, targets: GameCharacter[] = []): ChatMessage {
    let message = new ChatMessage();
    message.text = text;
    message.name = 'カエデ';
    message.from = SENDER;
    message.targetIds = targets.map(target => target.identifier).join(' ');
    message.setAttribute('timestamp', 100);
    message.initialize();
    return message;
  }

  async function send(text: string, targets: GameCharacter[] = []): Promise<ChatMessage[]> {
    await handler.processMessage(makeMessage(text, targets), chatTab.identifier);
    return chatTab.chatMessages;
  }

  /** 宛先が発言者自身なら、他ピアでは isDisplayable が false になる */
  function isToSelfOnly(message: ChatMessage): boolean {
    return message.to === SENDER;
  }

  it('ターゲットへバフを掛けた結果を投稿する', async () => {
    let target = GameCharacter.create('ゴブリン', 1, '');

    let posted = await send('t&毒/3', [target]);

    expect(posted.length).toBe(1);
    expect(posted[0].text).toContain('[ゴブリン]');
    expect(posted[0].text).toContain('毒');
    expect(isToSelfOnly(posted[0])).toBe(false);
    expect(target.buffList.buffs.length).toBe(1);
  });

  // t& だけの発言でターゲットがいないと、以前はループが回らず完全に無音だった
  it('ターゲット向けコマンドだけでターゲットがいなければ断る', async () => {
    let posted = await send('t&毒/3', []);

    expect(posted.length).toBe(1);
    expect(posted[0].text).toBe('ターゲットが未選択です');
    expect(isToSelfOnly(posted[0])).toBe(true);
  });

  it('自分向けの結果は出したうえでターゲット不在を断る', async () => {
    let self = GameCharacter.create('カエデ', 1, '');
    let message = makeMessage('&祝福/3 t&毒/3', []);
    message.characterId = self.identifier;

    await handler.processMessage(message, chatTab.identifier);

    expect(chatTab.chatMessages.length).toBe(2);
    expect(chatTab.chatMessages[0].text).toContain('祝福');
    expect(isToSelfOnly(chatTab.chatMessages[0])).toBe(false);
    expect(chatTab.chatMessages[1].text).toBe('ターゲットが未選択です');
    expect(isToSelfOnly(chatTab.chatMessages[1])).toBe(true);
  });

  // a& は targetIds を見ずにテーブル上の全員へ効くので、ターゲット不在は理由にならない
  it('全体向けコマンドではターゲット不在を断らない', async () => {
    GameCharacter.create('ゴブリン', 1, '');

    let posted = await send('a&毒/3', []);

    expect(posted.length).toBe(1);
    expect(posted[0].text).toContain('ゴブリン');
    expect(isToSelfOnly(posted[0])).toBe(false);
  });

  it('バフ操作を含まない発言では何も投稿しない', async () => {
    expect(await send('ふつうの発言')).toEqual([]);
  });
});
