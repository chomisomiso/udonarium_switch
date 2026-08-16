import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { GameSystemSetting } from '@udonarium/game-system-setting';
import { resetGameObjects } from 'testing/game-object-testing';

describe('GameSystemSetting', () => {
  // 実体は ObjectStore が持つので、store を空にすれば値も版も次の spec に漏れない
  afterEach(resetGameObjects);

  describe('instance', () => {
    it('固定 identifier で ObjectStore に載る', () => {
      let setting = GameSystemSetting.instance;

      expect(setting.identifier).toBe('GameSystemSetting');
      expect(ObjectStore.instance.get('GameSystemSetting')).toBe(setting);
    });

    it('既定はソード・ワールド2.5', () => {
      expect(GameSystemSetting.instance.gameType).toBe('SwordWorld2.5');
    });

    // static フィールドに抱えていると、リモート由来のインスタンスが先に
    // 登録されたときに store に載らない幽霊が返る
    it('store に既にあるインスタンスを横取りせず、それを返す', () => {
      let rival = new GameSystemSetting('GameSystemSetting');
      rival.gameType = 'Cthulhu7th';
      rival.initialize();

      expect(GameSystemSetting.instance).toBe(rival);
      expect(GameSystemSetting.instance.gameType).toBe('Cthulhu7th');
    });
  });

  describe('シリアライズ', () => {
    // GameObject 直系なので @SyncVar は syncData 直下に入る。ObjectNode 派生に
    // 変えると syncData.attributes へ回って属性が消える
    it('gameType が XML 属性として出る', () => {
      GameSystemSetting.instance.gameType = 'Cthulhu7th';

      let xml = GameSystemSetting.instance.toXml();

      expect(xml).toContain('game-system-setting');
      expect(xml).toContain('gameType="Cthulhu7th"');
    });

    it('XML から既存インスタンスを更新する', () => {
      let setting = GameSystemSetting.instance;

      ObjectSerializer.instance.parseXml('<game-system-setting gameType="Cthulhu7th"></game-system-setting>');

      expect(setting.gameType).toBe('Cthulhu7th');
      expect(GameSystemSetting.instance).toBe(setting);
    });

    it('XML から作られた一時オブジェクトを ObjectStore に残さない', () => {
      let setting = GameSystemSetting.instance;

      ObjectSerializer.instance.parseXml('<game-system-setting gameType="Cthulhu7th"></game-system-setting>');

      expect(ObjectStore.instance.get('GameSystemSetting')).toBe(setting);

      expect(ObjectStore.instance.getObjects(GameSystemSetting).length).toBe(1);
    });
  });
});
