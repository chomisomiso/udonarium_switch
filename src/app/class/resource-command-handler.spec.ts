import { ChatMessage } from '@udonarium/chat-message';
import { ChatTab } from '@udonarium/chat-tab';
import { DiceBot } from '@udonarium/dice-bot';
import { GameCharacter } from '@udonarium/game-character';
import { ResourceCommand } from '@udonarium/resource-command';
import { ResourceCommandHandler } from '@udonarium/resource-command-handler';
import { resetGameObjects } from 'testing/game-object-testing';

/**
 * コマンドの文法は resource-command.spec.ts が担当する。
 * ここでは解釈済みのコマンドを BCDice へ渡し、結果をチャットへ組み立てるまでを見る。
 *
 * BCDice は spyOn で差し替える。実際のロールは dice-bot.spec.ts が検証している。
 */
describe('ResourceCommandHandler', () => {
  let handler: ResourceCommandHandler;

  beforeEach(() => {
    handler = new ResourceCommandHandler();
  });

  afterEach(resetGameObjects);

  /** 発言を解釈して、BCDice へ渡す式に整形するまでを通す */
  function toDiceExpression(text: string): string {
    let command = ResourceCommand.parse(text)[0][0];
    return (handler as any).toDiceExpression(command);
  }

  describe('toDiceExpression', () => {
    // 単体の数値も式として評価させるためダミーダイスを足す
    it('数式にはダミーダイスを足す', () => {
      expect(toDiceExpression(':HP+5')).toBe('5+(1d1-1)');
    });

    it('減算では符号を前置する', () => {
      expect(toDiceExpression(':HP-5')).toBe('-5+(1d1-1)');
    });

    it('ダイス式にも足す', () => {
      expect(toDiceExpression(':HP+1d6')).toBe('1d6+(1d1-1)');
    });

    it('オプション文字は式に残さない', () => {
      expect(toDiceExpression(':HP-5ZL')).toBe('-5+(1d1-1)');
    });

    it('代入では符号を前置しない', () => {
      expect(toDiceExpression(':HP=10')).toBe('10+(1d1-1)');
    });

    // 文字列指定は BCDice に渡さずそのまま値として使うので整形しない
    it('数式でない指定はそのまま返す', () => {
      expect(toDiceExpression(':状態>毒')).toBe('毒');
    });

    // 以前は解釈の段階でダミーダイスを足していたため、
    // `:状態>5` が `5+(1d1-1)` という文字列としてリソースへ書き込まれていた
    it('文字列設定に数値を渡してもダミーダイスが混ざらない', () => {
      let command = ResourceCommand.parse(':状態>5')[0][0];

      expect(command.command).toBe('5');
      expect(command.operator).toBe('>');
    });
  });

  /** GameCharacter.create は HP 200 / MP 100 を持つコマを作る */
  function makeCharacter(name: string, hp: number = 144): GameCharacter {
    let character = GameCharacter.create(name, 1, '');
    character.setCurrentDataValue('HP', hp);
    return character;
  }

  /** BCDice を差し替える。複数回呼ばれる場合は順に返し、尽きたら最後の値を繰り返す */
  function stubRoll(...results: string[]): jasmine.Spy {
    let index = 0;
    return spyOn(DiceBot, 'diceRollAsync').and.callFake(async () => {
      let result = results[Math.min(index++, results.length - 1)];
      return { id: 'SwordWorld2.5', result: result, isSecret: false };
    });
  }

  describe('executeCommands', () => {
    async function run(text: string, character: GameCharacter): Promise<{ text: string, warnings: string[] }> {
      let commands = ResourceCommand.parse(text)[0];
      return await handler.executeCommands(commands, 'SwordWorld2.5', character.identifier);
    }

    it('素のダイス式は生出力を1行目に置き、ダミーダイスを消す', async () => {
      stubRoll('(-2D6+(1D1-1)) ＞ -7[3,4]+(1[1]-1) ＞ -7');
      let character = makeCharacter('カエデ');

      let result = await run(':HP-2d6', character);

      expect(result.text).toBe('(-2D6) ＞ -7[3,4] ＞ -7\n>HP: 144-7 > 137 \n');
      expect(character.getCurrentDataValue('HP')).toBe(137);
    });

    // 末尾の 14 だけを拾っていたので「1回転」が消えていた
    it('威力表のクリティカルは途中計算ごと流す', async () => {
      stubRoll('KeyNo.10c[10]+2 ＞ 2D:[6,6 6,3]=12,9 ＞ 7,5+2 ＞ 1回転 ＞ 14');
      let character = makeCharacter('カエデ');

      let result = await run(':HP-k10@10+2', character);

      expect(result.text).toBe('KeyNo.10c[10]+2 ＞ 2D:[6,6 6,3]=12,9 ＞ 7,5+2 ＞ 1回転 ＞ 14\n>HP: 144-14 > 130 \n');
      expect(character.getCurrentDataValue('HP')).toBe(130);
    });

    // 行末の整数へフォールバックすると `2D:[1,1]=2` の 2 を拾ってダメージが入る
    it('数値が出ない結果はリソースを変えずに流す', async () => {
      stubRoll('KeyNo.20c[10] ＞ 2D:[1,1]=2 ＞ ** ＞ 自動的失敗');
      let character = makeCharacter('カエデ');

      let result = await run(':HP-k10@10+2', character);

      expect(result.text).toBe('KeyNo.20c[10] ＞ 2D:[1,1]=2 ＞ ** ＞ 自動的失敗\n>HP: 変更なし\n');
      expect(result.warnings).toEqual([]);
      expect(character.getCurrentDataValue('HP')).toBe(144);
    });

    // 振り足しの途中だけが自動的失敗でも合計は成立する。旧書式ではこの `**` が消えていた
    it('振り足しの途中の自動的失敗は合計を殺さない', async () => {
      stubRoll('KeyNo.20c[10] ＞ 2D:[6,6 1,1]=12,2 ＞ 10,** ＞ 1回転 ＞ 10');
      let character = makeCharacter('カエデ');

      let result = await run(':HP-k20', character);

      expect(result.text).toBe('KeyNo.20c[10] ＞ 2D:[6,6 1,1]=12,2 ＞ 10,** ＞ 1回転 ＞ 10\n>HP: 144-10 > 134 \n');
      expect(character.getCurrentDataValue('HP')).toBe(134);
    });

    it('数値リテラルには生出力行を付けない', async () => {
      stubRoll('(-10+(1D1-1)) ＞ -10');
      let character = makeCharacter('カエデ');

      let result = await run(':HP-10', character);

      expect(result.text).toBe('>HP: 144-10 > 134 \n');
    });

    it('BCDiceが受け付けなかったコマンドは警告に回す', async () => {
      stubRoll('');
      let character = makeCharacter('カエデ');

      let result = await run(':HP-あばば', character);

      expect(result.text).toBe('');
      expect(result.warnings).toEqual(['>HP: 「あばば」を振れませんでした']);
      expect(character.getCurrentDataValue('HP')).toBe(144);
    });

    // 以前は isNaN で return していたため、後続どころか適用済みの結果まで消えていた
    it('無効な式が混ざっても他のコマンドの結果は残る', async () => {
      stubRoll('(-2D6+(1D1-1)) ＞ -7[3,4]+(1[1]-1) ＞ -7', '');
      let character = makeCharacter('カエデ');

      let result = await run(':HP-2d6 :MP-あばば', character);

      expect(result.text).toContain('>HP: 144-7 > 137');
      expect(result.warnings).toEqual(['>MP: 「あばば」を振れませんでした']);
    });

    it('生のコマンドを波括弧で添える書式は残っていない', async () => {
      stubRoll('KeyNo.10+2 ＞ 2D:[4,4]=8 ＞ 5+2 ＞ 7');
      let character = makeCharacter('カエデ');

      let result = await run(':HP-k10@10+2', character);

      expect(result.text).not.toContain('{');
    });
  });

  /**
   * ダミーダイスの除去は BCDice の出力書式を前提にしているので、ここだけは実物を通す。
   * 書式が変わったら他のテストはスタブごと通ってしまい、実機でだけ壊れる。
   */
  describe('parseRollResult（実BCDice）', () => {
    it('ダミーダイスを式からも出目からも消す', async () => {
      let roll = await handler.parseRollResult('-2d6+(1d1-1)', 'SwordWorld2.5');

      expect(roll.rawResult).not.toContain('1D1');
      expect(roll.rawResult).not.toContain('1[1]');
      // (-2D6) ＞ -6[1,5] ＞ -6
      expect(roll.rawResult).toMatch(/^\(-2D6\) ＞ -\d+\[\d,\d\] ＞ -\d+$/);
      expect(roll.value).toBe(Number(roll.rawResult.split(/\s＞\s/).pop()));
    });

    it('ダイスボット固有コマンドは生出力をそのまま渡す', async () => {
      let roll = await handler.parseRollResult('k20', 'SwordWorld2.5');

      expect(roll.rawResult).toMatch(/^KeyNo\.20/);
      expect(roll.id).toBe('SwordWorld2.5');
    });

    it('受け付けないコマンドは rawResult が空', async () => {
      let roll = await handler.parseRollResult('あばば', 'SwordWorld2.5');

      expect(roll.rawResult).toBe('');
      expect(roll.value).toBeNaN();
    });
  });

  /**
   * `t:` はターゲットごとに executeCommands を回す（＝ターゲットの数だけ別々に振る）。
   * `t{}` を含む発言はパレット側が1通ずつに分けるので、ここに来るのは分けられなかった側。
   */
  describe('processMessage', () => {
    let chatTab: ChatTab;

    beforeEach(() => {
      chatTab = new ChatTab();
      chatTab.initialize();
    });

    const SENDER = 'bob';

    function makeMessage(text: string, targets: GameCharacter[] = []): ChatMessage {
      let message = new ChatMessage();
      message.text = text;
      message.name = 'カエデ';
      message.from = SENDER;
      message.tag = 'SwordWorld2.5';
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

    it('ターゲットごとに別々の出目を並べる', async () => {
      stubRoll('(-2D6) ＞ -7[3,4] ＞ -7', '(-2D6) ＞ -4[1,3] ＞ -4');
      let goblinA = makeCharacter('ゴブリンA', 20);
      let goblinB = makeCharacter('ゴブリンB', 20);

      let posted = await send('t:HP-2d6', [goblinA, goblinB]);

      expect(posted.length).toBe(1);
      expect(posted[0].text).toBe(
        '[ゴブリンA]\n(-2D6) ＞ -7[3,4] ＞ -7\n>HP: 20-7 > 13 \n'
        + '[ゴブリンB]\n(-2D6) ＞ -4[1,3] ＞ -4\n>HP: 20-4 > 16 \n');
      expect(isToSelfOnly(posted[0])).toBe(false);
    });

    // 振れなかった理由はコマンド側にあるので、ターゲットの数だけ繰り返しても意味がない
    it('同じ警告はターゲット数ぶん繰り返さない', async () => {
      stubRoll('');
      let targets = [makeCharacter('A', 20), makeCharacter('B', 20), makeCharacter('C', 20)];

      let posted = await send('t:HP-あばば', targets);

      expect(posted.length).toBe(1);
      expect(posted[0].text).toBe('>HP: 「あばば」を振れませんでした');
      expect(isToSelfOnly(posted[0])).toBe(true);
    });

    /**
     * 持っていないリソースへの操作は振る前に捨てられる（executeCommands のリソース存在チェック）。
     * そのためターゲットごとに警告の「部分集合」が違い、行単位でないと重複が落ちない。
     */
    it('ターゲットごとに警告の顔ぶれが違っても行単位で1回ずつにする', async () => {
      stubRoll('');
      let bothResources = makeCharacter('A', 20);
      let mpOnly = makeCharacter('B', 20);
      let hp = mpOnly.detailDataElement.getFirstElementByName('HP');
      hp.parent.removeChild(hp);
      
      // A は2件、B は MP のぶんだけ。1本の文字列に畳むと Set が効かず「うぼぁ」が二重に出る
      let targetCommands = ResourceCommand.parse('t:HP-あばば t:MP-うぼぁ')[1];
      expect((await handler.executeCommands(targetCommands, 'SwordWorld2.5', bothResources.identifier)).warnings.length).toBe(2);
      expect((await handler.executeCommands(targetCommands, 'SwordWorld2.5', mpOnly.identifier)).warnings.length).toBe(1);

      let posted = await send('t:HP-あばば t:MP-うぼぁ', [bothResources, mpOnly]);

      expect(posted.length).toBe(1);
      expect(posted[0].text).toBe('>HP: 「あばば」を振れませんでした\n>MP: 「うぼぁ」を振れませんでした');
    });

    it('自分向けとターゲット向けは1通にまとめる', async () => {
      stubRoll('(-2D6) ＞ -7[3,4] ＞ -7', '(-1D6) ＞ -3[3] ＞ -3');
      let self = makeCharacter('カエデ');
      let target = makeCharacter('ゴブリン', 20);
      let message = makeMessage(':HP-2d6 t:HP-1d6', [target]);
      message.characterId = self.identifier;

      await handler.processMessage(message, chatTab.identifier);

      expect(chatTab.chatMessages.length).toBe(1);
      expect(chatTab.chatMessages[0].text).toBe(
        '(-2D6) ＞ -7[3,4] ＞ -7\n>HP: 144-7 > 137 \n'
        + '[ゴブリン]\n(-1D6) ＞ -3[3] ＞ -3\n>HP: 20-3 > 17 \n');
    });

    // t{} を含まない発言はパレットの事前チェックを通らないので、ここで拾うしかない
    it('ターゲット向けコマンドだけでターゲットがいなければ断る', async () => {
      stubRoll('(-2D6) ＞ -7[3,4] ＞ -7');

      let posted = await send('t:HP-2d6', []);

      expect(posted.length).toBe(1);
      expect(posted[0].text).toBe('ターゲットが未選択です');
      expect(isToSelfOnly(posted[0])).toBe(true);
    });

    it('自分向けの結果は出したうえでターゲット不在を断る', async () => {
      stubRoll('(-2D6) ＞ -7[3,4] ＞ -7');
      let self = makeCharacter('カエデ');
      let message = makeMessage(':HP-2d6 t:HP-1d6', []);
      message.characterId = self.identifier;

      await handler.processMessage(message, chatTab.identifier);

      expect(chatTab.chatMessages.length).toBe(2);
      expect(chatTab.chatMessages[0].text).toContain('>HP: 144-7 > 137');
      expect(isToSelfOnly(chatTab.chatMessages[0])).toBe(false);
      expect(chatTab.chatMessages[1].text).toBe('ターゲットが未選択です');
      expect(isToSelfOnly(chatTab.chatMessages[1])).toBe(true);
    });

    it('自分向けコマンドだけならターゲット不在を断らない', async () => {
      stubRoll('(-2D6) ＞ -7[3,4] ＞ -7');
      let self = makeCharacter('カエデ');
      let message = makeMessage(':HP-2d6', []);
      message.characterId = self.identifier;

      await handler.processMessage(message, chatTab.identifier);

      expect(chatTab.chatMessages.length).toBe(1);
      expect(chatTab.chatMessages[0].text).not.toContain('ターゲット');
    });

    it('結果も警告も無ければ何も投稿しない', async () => {
      stubRoll('(2D6) ＞ 7[3,4] ＞ 7');

      expect(await send('ふつうの発言')).toEqual([]);
    });
  });
});
