import { CharacterPart } from '@udonarium/character-part/character-part';
import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';
import { GameCharacterTargetingService } from 'service/game-character-targeting.service';
import { flushMicrotasks, resetGameObjects } from 'testing/game-object-testing';
import { makeMultiPartCharacter } from 'testing/multi-part-testing';

/**
 * コンストラクタ引数を持たないので TestBed を通さず直接組み立てる。
 * 実行時の UPDATE_GAME_OBJECT は EventSystem.call（ネットワークのループバック経由で非同期）だが、
 * ここで見たいのはハンドラの中身なので trigger で同期発火させる。
 */
describe('GameCharacterTargetingService', () => {
  let targeting: GameCharacterTargetingService;

  beforeEach(() => {
    targeting = new GameCharacterTargetingService();
  });

  afterEach(resetGameObjects);

  /** ObjectStore に載せる。載せないと identifier からの逆引きができない */
  function makeCharacter(): GameCharacter {
    let character = new GameCharacter();
    character.initialize();
    return character;
  }

  function updated(character: GameCharacter) {
    EventSystem.trigger('UPDATE_GAME_OBJECT', character.toContext());
  }

  function deleted(identifier: string, aliasName: string = '') {
    EventSystem.trigger('DELETE_GAME_OBJECT', { aliasName: aliasName, identifier: identifier });
  }

  describe('集合の操作', () => {
    it('追加したキャラを保持する', () => {
      let character = makeCharacter();
      targeting.add(character);

      expect(targeting.has(character)).toBe(true);
      expect(Array.from(targeting.getTargets())).toEqual([character]);
    });

    it('外したキャラは保持しない', () => {
      let character = makeCharacter();
      targeting.add(character);
      targeting.remove(character);

      expect(targeting.has(character)).toBe(false);
      expect(targeting.getTargets().size).toBe(0);
    });

    it('clear で全部外れる', () => {
      targeting.add(makeCharacter());
      targeting.add(makeCharacter());
      targeting.clear();

      expect(targeting.getTargets().size).toBe(0);
    });
  });

  describe('テーブルを降りたときの解除', () => {
    it('テーブル以外へ移ると外れる', () => {
      let character = makeCharacter();
      targeting.add(character);

      character.location.name = 'graveyard';
      updated(character);

      expect(targeting.has(character)).toBe(false);
    });

    // ドラッグ中は座標更新のたびに UPDATE_GAME_OBJECT が流れる。ここで外れたら操作にならない
    it('テーブル上のままなら外れない', () => {
      let character = makeCharacter();
      targeting.add(character);

      character.location.x = 100;
      updated(character);

      expect(targeting.has(character)).toBe(true);
    });

    it('ターゲットでないキャラが降りても巻き添えにしない', () => {
      let target = makeCharacter();
      let other = makeCharacter();
      targeting.add(target);

      other.location.name = 'common';
      updated(other);

      expect(targeting.has(target)).toBe(true);
    });
  });

  describe('削除されたときの解除', () => {
    it('削除されると外れる', () => {
      let character = makeCharacter();
      targeting.add(character);

      deleted(character.identifier);

      expect(targeting.has(character)).toBe(false);
    });

    // object-synchronizer は aliasName を空文字で流すことがあるので、フィルタに使ってはいけない
    it('aliasName が空文字でも外れる', () => {
      let character = makeCharacter();
      targeting.add(character);

      deleted(character.identifier, '');

      expect(targeting.has(character)).toBe(false);
    });

    it('別の identifier の削除では巻き添えにしない', () => {
      let target = makeCharacter();
      let other = makeCharacter();
      targeting.add(target);

      deleted(other.identifier);

      expect(targeting.has(target)).toBe(true);
    });
  });

  describe('多部位コマ', () => {
    let character: GameCharacter;
    let upper: CharacterPart;
    let lower: CharacterPart;

    beforeEach(() => {
      character = makeMultiPartCharacter();
      [upper, lower] = character.parts;
    });

    describe('stateOf', () => {
      it('部位がひとつもターゲットでなければ none', () => {
        expect(targeting.stateOf(character)).toBe('none');
      });

      it('一部の部位だけなら partial', () => {
        targeting.add(upper);

        expect(targeting.stateOf(character)).toBe('partial');
      });

      it('全部位なら all', () => {
        targeting.add(upper);
        targeting.add(lower);

        expect(targeting.stateOf(character)).toBe('all');
      });

      it('単部位コマはコマ自身で決まる', () => {
        let single = makeCharacter();
        targeting.add(single);

        expect(targeting.stateOf(single)).toBe('all');
      });
    });

    describe('toggleCharacter', () => {
      it('none から全部位を入れる', () => {
        targeting.toggleCharacter(character);

        expect(Array.from(targeting.getTargets())).toEqual([upper, lower]);
      });

      it('all から全部位を外す', () => {
        targeting.setCharacterTargeted(character, true);
        targeting.toggleCharacter(character);

        expect(targeting.getTargets().size).toBe(0);
      });

      it('partial からは全部位を外す', () => {
        targeting.add(lower);
        targeting.toggleCharacter(character);

        expect(targeting.getTargets().size).toBe(0);
      });

      it('コマ本体はターゲットに入らない', () => {
        targeting.toggleCharacter(character);

        expect(targeting.has(character)).toBe(false);
      });
    });

    it('テーブルを降りると全部位が外れる', () => {
      targeting.setCharacterTargeted(character, true);

      character.location.name = 'graveyard';
      updated(character);

      expect(targeting.getTargets().size).toBe(0);
    });

    it('部位が削除されるとその部位だけ外れる', () => {
      targeting.setCharacterTargeted(character, true);

      deleted(lower.identifier);

      expect(Array.from(targeting.getTargets())).toEqual([upper]);
    });

    it('部位の変化は持ち主のコマの identifier でも知らせる', async () => {
      let notified = jasmine.createSpy('notified');
      EventSystem.register(notified).on(`UPDATE_TARGET/identifier/${character.identifier}`, () => notified());

      targeting.add(upper);
      await flushMicrotasks();

      expect(notified).toHaveBeenCalledTimes(1);
    });

    it('単部位コマに部位が足されたら、コマ本体のターゲットは外れる', () => {
      let single = makeCharacter();
      targeting.add(single);
      let part = single.appendChild(CharacterPart.create('胴体'));

      EventSystem.trigger(`UPDATE_GAME_OBJECT/aliasName/${CharacterPart.aliasName}`, part.toContext());

      expect(targeting.has(single)).toBe(false);
    });
  });
});
