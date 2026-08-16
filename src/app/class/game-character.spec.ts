import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { GameSystemSetting } from '@udonarium/game-system-setting';
import { resetGameObjects } from 'testing/game-object-testing';

describe('GameCharacter', () => {
  afterEach(resetGameObjects);

  /** createDataElements() が画像を 1 枚作るので、そこから必要枚数まで足す */
  function makeCharacter(imageCount: number = 1): GameCharacter {
    let character = new GameCharacter();
    (character as any).createDataElements();
    while (character.imageCount < imageCount) character.addImageElement();
    return character;
  }

  /** 画像に見分けの付く名前を付ける */
  function nameImages(character: GameCharacter, ...names: string[]): GameCharacter {
    character.imageElements.forEach((element, i) => GameCharacter.setImageName(element, names[i]));
    return character;
  }

  function imageNames(character: GameCharacter): string[] {
    return character.imageElements.map(element => GameCharacter.getImageName(element));
  }

  /** HP 200 / MP 100 を持つコマ。createTestGameDataElement が既定リソースを組む */
  function makeCharacterWithResources(): GameCharacter {
    return GameCharacter.create('テスト', 1, '');
  }

  /** 型を持たないプレーンテキストのタグを足す */
  function appendPlainTag(character: GameCharacter, name: string, value: string): void {
    character.detailDataElement.appendChild(DataElement.create(name, value));
  }

  describe('imageIndex', () => {
    it('既定は先頭の画像', () => {
      expect(makeCharacter(3).imageIndex).toBe(0);
    });

    it('範囲内の番号はそのまま保持する', () => {
      let character = makeCharacter(3);
      character.imageIndex = 2;

      expect(character.imageIndex).toBe(2);
    });

    it('範囲外の番号は代入時にクランプする', () => {
      let character = makeCharacter(3);

      character.imageIndex = 5;
      expect(character.imageIndex).toBe(2);

      character.imageIndex = -1;
      expect(character.imageIndex).toBe(0);
    });

    it('文字列を数値として受け付ける', () => {
      let character = makeCharacter(3);
      character.imageIndex = '2' as any;

      expect(character.imageIndex).toBe(2);
    });

    // 他のピアが画像を削除して枚数が減ることがあるため、クランプは読み出し時にも掛かる。
    // 設定値そのものは保持されるので、画像が戻れば元の選択に復帰する
    it('設定値を保ったまま読み出し時にクランプする', () => {
      let character = makeCharacter(3);
      character.imageIndexSetting = 5;

      expect(character.imageIndex).toBe(2);
      expect(character.imageIndexSetting).toBe(5);
    });

    // imageCount が 0 のとき clamp(x, 0, -1) となり、MathUtil.clamp が min を後に適用するため 0 になる
    it('画像が 1 枚も無ければ 0 を返す', () => {
      let character = new GameCharacter();

      expect(character.imageCount).toBe(0);
      expect(character.imageIndex).toBe(0);

      character.imageIndexSetting = 5;
      expect(character.imageIndex).toBe(0);
    });
  });

  describe('addImageElement', () => {
    it('画像を末尾に追加する', () => {
      let character = makeCharacter(1);
      let added = character.addImageElement();

      expect(character.imageCount).toBe(2);
      expect(character.imageElements[1]).toBe(added);
      expect(added.getAttribute('type')).toBe('image');
    });

    it('image 要素がまだ無ければ null', () => {
      let character = new GameCharacter();

      expect(character.addImageElement()).toBeNull();
      expect(character.imageCount).toBe(0);
    });
  });

  describe('removeImageElement', () => {
    it('最後の 1 枚は削除しない', () => {
      let character = makeCharacter(1);

      expect(character.removeImageElement(0)).toBe(false);
      expect(character.imageCount).toBe(1);
    });

    it('存在しない番号は削除しない', () => {
      let character = makeCharacter(3);

      expect(character.removeImageElement(9)).toBe(false);
      expect(character.removeImageElement(-1)).toBe(false);
      expect(character.imageCount).toBe(3);
    });

    it('指定した画像を取り除く', () => {
      let character = nameImages(makeCharacter(3), 'A', 'B', 'C');

      expect(character.removeImageElement(1)).toBe(true);
      expect(imageNames(character)).toEqual(['A', 'C']);
    });

    it('選択中より前を削除しても表示画像が変わらない', () => {
      let character = nameImages(makeCharacter(3), 'A', 'B', 'C');
      character.imageIndex = 2;

      character.removeImageElement(0);

      expect(character.imageIndex).toBe(1);
      expect(imageNames(character)[character.imageIndex]).toBe('C');
    });

    it('選択中より後を削除しても番号は変わらない', () => {
      let character = nameImages(makeCharacter(3), 'A', 'B', 'C');
      character.imageIndex = 0;

      character.removeImageElement(2);

      expect(character.imageIndex).toBe(0);
      expect(imageNames(character)[character.imageIndex]).toBe('A');
    });

    it('選択中の末尾を削除すると範囲内に正規化する', () => {
      let character = nameImages(makeCharacter(3), 'A', 'B', 'C');
      character.imageIndex = 2;

      character.removeImageElement(2);

      expect(character.imageIndex).toBe(1);
      expect(character.imageIndexSetting).toBe(1);
      expect(imageNames(character)).toEqual(['A', 'B']);
    });
  });

  describe('moveImageElement', () => {
    it('後ろの画像と入れ替える', () => {
      let character = nameImages(makeCharacter(3), 'A', 'B', 'C');

      character.moveImageElement(0, 1);

      expect(imageNames(character)).toEqual(['B', 'A', 'C']);
    });

    it('前の画像と入れ替える', () => {
      let character = nameImages(makeCharacter(3), 'A', 'B', 'C');

      character.moveImageElement(2, -1);

      expect(imageNames(character)).toEqual(['A', 'C', 'B']);
    });

    // 移動量は Math.sign でしか見ないので、大きな値を渡しても隣としか入れ替わらない
    it('offset は符号だけを見る', () => {
      let character = nameImages(makeCharacter(3), 'A', 'B', 'C');

      character.moveImageElement(0, 99);

      expect(imageNames(character)).toEqual(['B', 'A', 'C']);
    });

    it('移動先が範囲外なら何もしない', () => {
      let character = nameImages(makeCharacter(3), 'A', 'B', 'C');

      character.moveImageElement(0, -1);
      character.moveImageElement(2, 1);
      character.moveImageElement(9, 1);

      expect(imageNames(character)).toEqual(['A', 'B', 'C']);
    });

    it('選択中の画像を動かすと選択も追従する', () => {
      let character = nameImages(makeCharacter(3), 'A', 'B', 'C');
      character.imageIndex = 0;

      character.moveImageElement(0, 1);

      expect(character.imageIndex).toBe(1);
      expect(imageNames(character)[character.imageIndex]).toBe('A');
    });

    it('入れ替え相手が選択中でも表示画像が変わらない', () => {
      let character = nameImages(makeCharacter(3), 'A', 'B', 'C');
      character.imageIndex = 1;

      character.moveImageElement(0, 1);

      expect(character.imageIndex).toBe(0);
      expect(imageNames(character)[character.imageIndex]).toBe('B');
    });
  });

  describe('getImageName / setImageName', () => {
    it('未設定なら空文字', () => {
      let character = makeCharacter(1);

      expect(GameCharacter.getImageName(character.imageElements[0])).toBe('');
    });

    it('名前を設定して読み出せる', () => {
      let character = makeCharacter(1);
      GameCharacter.setImageName(character.imageElements[0], '立ち絵');

      expect(GameCharacter.getImageName(character.imageElements[0])).toBe('立ち絵');
    });

    it('空文字を設定すると属性ごと削除する', () => {
      let element = makeCharacter(1).imageElements[0];
      GameCharacter.setImageName(element, '立ち絵');

      GameCharacter.setImageName(element, '');

      expect(GameCharacter.getImageName(element)).toBe('');
      expect(element.getAttribute('imageName')).toBe('');
    });

    it('要素が null でも落ちない', () => {
      expect(GameCharacter.getImageName(null)).toBe('');
      expect(() => GameCharacter.setImageName(null, '立ち絵')).not.toThrow();
    });
  });

  describe('komaImageHeight', () => {
    it('既定値は 100', () => {
      expect(new GameCharacter().komaImageHeight).toBe(100);
    });

    it('上下限でクランプする', () => {
      let character = new GameCharacter();

      character.komaImageHeight = 10;
      expect(character.komaImageHeight).toBe(GameCharacter.minKomaImageHeight);

      character.komaImageHeight = 10000;
      expect(character.komaImageHeight).toBe(GameCharacter.maxKomaImageHeight);
    });

    it('範囲内の値はそのまま保持する', () => {
      let character = new GameCharacter();
      character.komaImageHeight = 300;

      expect(character.komaImageHeight).toBe(300);
    });

    it('文字列を数値として受け付ける', () => {
      let character = new GameCharacter();
      character.komaImageHeight = '300' as any;

      expect(character.komaImageHeight).toBe(300);
    });
  });

  describe('isVisibleInInventory', () => {
    function makeCharacterAt(location: string, isHiddenInInventory: boolean = false): GameCharacter {
      let character = makeCharacterWithResources();
      character.location.name = location;
      character.isHiddenInInventory = isHiddenInInventory;
      return character;
    }

    it('テーブル上で一覧に出すコマは true', () => {
      expect(makeCharacterAt('table').isVisibleInInventory).toBe(true);
    });

    it('一覧から除外したコマは false', () => {
      expect(makeCharacterAt('table', true).isVisibleInInventory).toBe(false);
    });

    it('テーブル外のコマは false', () => {
      expect(makeCharacterAt('graveyard').isVisibleInInventory).toBe(false);
      expect(makeCharacterAt('common').isVisibleInInventory).toBe(false);
    });
  });

  // 一覧の再描画を促すかの判定に使う。ここに入れ忘れた値は他ピアで古いまま残る
  describe('inventoryRenderKey', () => {
    it('コマ画像の切り替えで変わる', () => {
      let character = makeCharacterWithResources();
      let before = character.inventoryRenderKey;

      character.imageIndexSetting = 1;

      expect(character.inventoryRenderKey).not.toBe(before);
    });

    it('一覧非表示の切り替えで変わる', () => {
      let character = makeCharacterWithResources();
      let before = character.inventoryRenderKey;

      character.isHiddenInInventory = true;

      expect(character.inventoryRenderKey).not.toBe(before);
    });

    // 含めるとドラッグ中ずっと再描画が走る
    it('位置と回転では変わらない', () => {
      let character = makeCharacterWithResources();
      let before = character.inventoryRenderKey;

      character.location.x = 100;
      character.location.y = 200;
      character.posZ = 5;
      character.rotate = 90;

      expect(character.inventoryRenderKey).toBe(before);
    });
  });

  // NaN を書き込むとリソースが表示も計算も壊れたまま同期され、補正コマンドを撃っても NaN のままになる
  describe('リソースへの書き込み', () => {
    it('現在値に NaN を渡しても書き込まない', () => {
      let character = makeCharacterWithResources();

      expect(character.setCurrentDataValue('HP', NaN)).toBe(false);
      expect(character.getCurrentDataValue('HP')).toBe(200);
    });

    it('最大値に NaN を渡しても書き込まない', () => {
      let character = makeCharacterWithResources();

      expect(character.setMaxDataValue('HP', NaN)).toBe(false);
      expect(character.getMaxDataValue('HP')).toBe(200);
    });

    it('非数値の型なしタグへ NaN を書き込まない', () => {
      let character = makeCharacterWithResources();
      appendPlainTag(character, '弱点等', '炎に弱い');

      expect(character.setCurrentDataValue('弱点等', NaN)).toBe(false);
      expect(character.detailDataElement.getFirstElementByName('弱点等').value).toBe('炎に弱い');
    });

  });

  describe('create', () => {
    it('チャットパレットの既定ダイスボットがルーム設定に追随する', () => {
      GameSystemSetting.instance.gameType = 'Cthulhu7th';

      expect(GameCharacter.create('テスト', 1, '').chatPalette.dicebot).toBe('Cthulhu7th');
    });
  });
});
