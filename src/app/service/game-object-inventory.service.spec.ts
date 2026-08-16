import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';
import { GameObjectInventoryService } from 'service/game-object-inventory.service';
import { resetGameObjects } from 'testing/game-object-testing';

/**
 * コンストラクタ引数を持たないので TestBed を通さず直接組み立てる。
 * ObjectInventory はコマ一覧をキャッシュし初回参照で検索するので、
 * コマを揃えてからサービスを作る。
 */
describe('GameObjectInventoryService', () => {
  afterEach(resetGameObjects);

  /** ObjectStore に載せないと inventory の検索に乗らない。create() の中で initialize される */
  function makeCharacter(name: string, location: string, isHiddenInInventory: boolean = false): GameCharacter {
    let character = GameCharacter.create(name, 1, '');
    character.location.name = location;
    character.isHiddenInInventory = isHiddenInInventory;
    return character;
  }

  function names(characters: GameCharacter[]): string[] {
    return characters.map(character => character.name);
  }

  /**
   * ダッシュボードの両ビューは OnPush で UPDATE_INVENTORY を再描画の合図にしている。
   * コマの移動でも UPDATE_GAME_OBJECT は飛ぶので、何で再描画を促すかはここで絞る
   */
  describe('UPDATE_INVENTORY の発火', () => {
    /** 発火を数える。register の解除は afterEach の resetGameObjects が行う */
    function countInventoryUpdates(): { count: number } {
      let counter = { count: 0 };
      EventSystem.register(counter).on('UPDATE_INVENTORY', () => { counter.count++; });
      return counter;
    }

    function updated(character: GameCharacter): void {
      EventSystem.trigger('UPDATE_GAME_OBJECT', character.toContext());
    }

    /** 初回は比較用の Map が空で必ず発火するので、先に一度撃って揃えてから数える */
    function primedCounter(character: GameCharacter): { count: number } {
      new GameObjectInventoryService();
      updated(character);
      return countInventoryUpdates();
    }

    it('コマ画像の切り替えで再描画を促す', () => {
      let character = makeCharacter('キャラA', 'table');
      let counter = primedCounter(character);

      character.imageIndexSetting = 1;
      updated(character);

      expect(counter.count).toBe(1);
    });

    it('一覧非表示の切り替えでも再描画を促す', () => {
      let character = makeCharacter('キャラA', 'table');
      let counter = primedCounter(character);

      character.isHiddenInInventory = true;
      updated(character);

      expect(counter.count).toBe(1);
    });

    // ドラッグ中はこれが連続で飛ぶ。拾うと OnPush にした意味が無くなる
    it('コマの移動では再描画を促さない', () => {
      let character = makeCharacter('キャラA', 'table');
      let counter = primedCounter(character);

      character.location.x = 100;
      character.location.y = 200;
      updated(character);

      expect(counter.count).toBe(0);
    });
  });

  describe('visibleTableCharacters', () => {
    it('テーブル上のコマを返す', () => {
      makeCharacter('キャラA', 'table');
      makeCharacter('キャラB', 'table');
      let service = new GameObjectInventoryService();

      expect(names(service.visibleTableCharacters)).toEqual(['キャラA', 'キャラB']);
    });

    it('一覧から除外したコマは返さない', () => {
      makeCharacter('キャラA', 'table');
      makeCharacter('隠しNPC', 'table', true);
      let service = new GameObjectInventoryService();

      expect(names(service.visibleTableCharacters)).toEqual(['キャラA']);
    });

    it('テーブル外のコマは返さない', () => {
      makeCharacter('キャラA', 'table');
      makeCharacter('墓場のコマ', 'graveyard');
      makeCharacter('共有のコマ', 'common');
      let service = new GameObjectInventoryService();

      expect(names(service.visibleTableCharacters)).toEqual(['キャラA']);
    });

    it('テーブルが空なら空配列', () => {
      expect(new GameObjectInventoryService().visibleTableCharacters).toEqual([]);
    });

    // isHiddenInInventory の変更は ObjectInventory のコマ一覧キャッシュを無効化しない。
    // 読むたびに絞っているから追従できる、という前提を固定する
    it('コマ一覧のキャッシュを作り直さなくても、隠した時点で消える', () => {
      let character = makeCharacter('隠されるNPC', 'table');
      let service = new GameObjectInventoryService();
      expect(names(service.visibleTableCharacters)).toEqual(['隠されるNPC']);

      character.isHiddenInInventory = true;

      expect(service.visibleTableCharacters).toEqual([]);
    });
  });
});
