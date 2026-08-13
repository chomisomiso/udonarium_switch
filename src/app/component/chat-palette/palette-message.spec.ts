import { ChatPalette } from '@udonarium/chat-palette';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { planPaletteMessages } from 'component/chat-palette/palette-message';
import { resetGameObjects } from 'testing/game-object-testing';

describe('planPaletteMessages', () => {
  afterEach(resetGameObjects);

  /** パレット文字列を渡さなければ、パレットを持たないコマになる */
  function makeCharacter(name: string, paletteSource?: string): GameCharacter {
    let character = new GameCharacter();
    // createDataElements() は protected。テストからコマの器だけ作らせる
    (character as any).createDataElements();
    character.commonDataElement.appendChild(DataElement.create('name', name));
    if (paletteSource != null) {
      let palette = new ChatPalette();
      palette.setPalette(paletteSource);
      character.appendChild(palette);
    }
    return character;
  }

  /** numberResource は value が最大値、currentValue が現在値 */
  function addResource(character: GameCharacter, name: string, current: number, max: number): GameCharacter {
    character.detailDataElement.appendChild(
      DataElement.create(name, max, { type: 'numberResource', currentValue: current + '' }));
    return character;
  }

  function texts(plan: { messages: { text: string }[] }): string[] {
    return plan.messages.map(message => message.text);
  }

  describe('ターゲット参照を含まない発言', () => {
    it('展開結果を1通にまとめ、ターゲット全員を載せる', () => {
      let sender = addResource(makeCharacter('術者', '//気合=2\n2d6+{気合}'), 'HP', 10, 30);
      let targets = [makeCharacter('ゴブリンA'), makeCharacter('ゴブリンB')];

      let plan = planPaletteMessages(sender, '2d6+{気合} {HP}', targets);

      expect(plan.warning).toBeUndefined();
      expect(texts(plan)).toEqual(['2d6+2 10']);
      expect(plan.messages[0].targets).toEqual(targets);
    });

    it('ターゲットが0体でも警告せずに送る', () => {
      let plan = planPaletteMessages(makeCharacter('術者', ''), '2d6', []);

      expect(plan.warning).toBeUndefined();
      expect(texts(plan)).toEqual(['2d6']);
    });
  });

  describe('ターゲット参照を含む発言', () => {
    it('ターゲットが0体なら警告だけ返して1通も作らない', () => {
      let plan = planPaletteMessages(makeCharacter('術者', ''), 't:HP-t{HP}', []);

      expect(plan.warning).toBe('ターゲットが未選択です');
      expect(plan.messages).toEqual([]);
    });

    it('ターゲットごとに1通へ分け、各通は自分の値で展開する', () => {
      let sender = makeCharacter('術者', '');
      let goblin = addResource(makeCharacter('ゴブリン'), 'HP', 8, 20);
      let ogre = addResource(makeCharacter('オーガ'), 'HP', 30, 50);

      let plan = planPaletteMessages(sender, 't:HP=t{HP^}', [goblin, ogre]);

      expect(texts(plan)).toEqual(['t:HP=20 [ゴブリン]', 't:HP=50 [オーガ]']);
      // 1通が1体だけを見るからこそ、ハンドラ側のループと掛け算にならない
      expect(plan.messages.map(message => message.targets)).toEqual([[goblin], [ogre]]);
    });

    it('末尾の ^ がなければ現在値で展開する', () => {
      let goblin = addResource(makeCharacter('ゴブリン'), 'HP', 8, 20);

      let plan = planPaletteMessages(makeCharacter('術者', ''), 't{HP}', [goblin]);

      expect(texts(plan)).toEqual(['8 [ゴブリン]']);
    });

    // 自分向け／全体向けを毎通に残すと、ターゲットの体数ぶん重ねて掛かってしまう
    it('2通目以降からは自分向けリソース操作と全体バフを落とす', () => {
      let sender = makeCharacter('術者', '');
      let a = addResource(makeCharacter('A'), 'HP', 8, 20);
      let b = addResource(makeCharacter('B'), 'HP', 5, 10);

      let plan = planPaletteMessages(sender, ':MP-3 a&祝福/3 t&呪い/2 t{HP}', [a, b]);

      expect(texts(plan)).toEqual([':MP-3 a&祝福/3 t&呪い/2 8 [A]', 't&呪い/2 5 [B]']);
    });

    it('パレット変数の中に隠れたターゲット参照も検出する', () => {
      let sender = makeCharacter('術者', '//ダメージ=t{HP}');
      let goblin = addResource(makeCharacter('ゴブリン'), 'HP', 8, 20);

      let plan = planPaletteMessages(sender, '{ダメージ}', [goblin]);

      expect(plan.warning).toBeUndefined();
      expect(texts(plan)).toEqual(['8 [ゴブリン]']);
    });

    it('ターゲットが持たないリソースは空文字へ展開する', () => {
      let plan = planPaletteMessages(makeCharacter('術者', ''), 't{HP}', [makeCharacter('気配')]);

      expect(texts(plan)).toEqual([' [気配]']);
    });
  });

  describe('パレットを持たない発言者', () => {
    it('展開せず素通しで1通にする', () => {
      let targets = [makeCharacter('A')];

      let plan = planPaletteMessages(makeCharacter('術者'), 't{HP} {気合}', targets);

      expect(plan.warning).toBeUndefined();
      expect(texts(plan)).toEqual(['t{HP} {気合}']);
      expect(plan.messages[0].targets).toEqual(targets);
    });

    it('発言者が null でも素通しで1通にする', () => {
      let plan = planPaletteMessages(null, '2d6', []);

      expect(texts(plan)).toEqual(['2d6']);
      expect(plan.messages[0].targets).toEqual([]);
    });
  });
});
