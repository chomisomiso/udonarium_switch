import { BuffCommandHandler } from '@udonarium/buff-command-handler';
import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { ChatMessage } from '@udonarium/chat-message';
import { ChatTab } from '@udonarium/chat-tab';
import { GameCharacter } from '@udonarium/game-character';
import { resetGameObjects } from 'testing/game-object-testing';
import { makeMultiPartCharacter } from 'testing/multi-part-testing';

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

  function makeMessage(text: string, targets: CharacterUnit[] = []): ChatMessage {
    let message = new ChatMessage();
    message.text = text;
    message.name = 'カエデ';
    message.from = SENDER;
    message.targetIds = targets.map(target => target.identifier).join(' ');
    message.setAttribute('timestamp', 100);
    message.initialize();
    return message;
  }

  async function send(text: string, targets: CharacterUnit[] = []): Promise<ChatMessage[]> {
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

  describe('多部位コマ', () => {
    it('部位のターゲットにはその部位だけへ掛ける', async () => {
      let character = makeMultiPartCharacter();
      let [upper, lower] = character.parts;

      let posted = await send('t&毒/3/回避修正-1', [lower]);

      expect(posted[0].text).toContain('[ヒブレイザン(下半身)]');
      expect(lower.buffs.length).toBe(1);
      expect(lower.getCurrentDataValue('回避修正')).toBe(-1);
      expect(upper.buffs.length).toBe(0);
      expect(upper.getCurrentDataValue('回避修正')).toBe(0);
    });

    it('自分向けは発言者の部位へ掛ける', async () => {
      let upper = makeMultiPartCharacter().parts[0];
      let message = makeMessage('&祝福/3', []);
      message.characterId = upper.identifier;

      await handler.processMessage(message, chatTab.identifier);

      expect(upper.buffs.map(buff => buff.buffName)).toEqual(['祝福']);
    });

    it('全体向けは部位ごとに掛ける', async () => {
      let character = makeMultiPartCharacter();

      let posted = await send('a&毒/3', []);

      expect(posted[0].text).toContain('[ヒブレイザン(上半身)]');
      expect(posted[0].text).toContain('[ヒブレイザン(下半身)]');
      expect(character.parts.map(part => part.buffs.length)).toEqual([1, 1]);
      expect(character.buffs.length).toBe(0);
    });

    // 本体は語り用の発言者。どの部位のことか決まらない
    it('本体からの自分向けは掛けず、自分にだけ警告する', async () => {
      let character = makeMultiPartCharacter();
      let message = makeMessage('&祝福/3', []);
      message.characterId = character.identifier;

      await handler.processMessage(message, chatTab.identifier);

      expect(chatTab.chatMessages.length).toBe(1);
      expect(chatTab.chatMessages[0].text).toBe(CharacterUnit.PART_NOT_SELECTED_WARNING);
      expect(isToSelfOnly(chatTab.chatMessages[0])).toBe(true);
      expect(character.buffs.length).toBe(0);
    });

    it('本体の警告とターゲット未選択の警告は、両方とも出す', async () => {
      let character = makeMultiPartCharacter();
      let message = makeMessage('&祝福/3 t&毒/3', []);
      message.characterId = character.identifier;

      await handler.processMessage(message, chatTab.identifier);

      let warning = chatTab.chatMessages[chatTab.chatMessages.length - 1];
      expect(warning.text).toContain(CharacterUnit.PART_NOT_SELECTED_WARNING);
      expect(warning.text).toContain('ターゲットが未選択です');
    });
  });
});
