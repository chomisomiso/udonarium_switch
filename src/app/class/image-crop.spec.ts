import { DataElement } from '@udonarium/data-element';
import { ImageCrop } from '@udonarium/image-crop';
import { resetGameObjects } from 'testing/game-object-testing';

describe('ImageCrop', () => {
  describe('parse', () => {
    it('3 つの数値を読む', () => {
      let crop = ImageCrop.parse('40 20 1.5');

      expect(crop.x).toBe(40);
      expect(crop.y).toBe(20);
      expect(crop.scale).toBe(1.5);
    });

    it('カンマ区切りと余分な空白を許す', () => {
      let crop = ImageCrop.parse('  40 ,  20,1.5  ');

      expect(crop.x).toBe(40);
      expect(crop.y).toBe(20);
      expect(crop.scale).toBe(1.5);
    });

    it('4 つめ以降は無視する', () => {
      expect(ImageCrop.parse('40 20 1.5 99').x).toBe(40);
    });

    // 既定値の画像は数が多いので、変更検知のたびにインスタンスを作らないようにしている
    it('既定値になる入力では共有インスタンスを返す', () => {
      expect(ImageCrop.parse('')).toBe(ImageCrop.default);
      expect(ImageCrop.parse(null)).toBe(ImageCrop.default);
      expect(ImageCrop.parse('50 0 1')).toBe(ImageCrop.default);
    });

    it('値が足りない入力は既定値', () => {
      expect(ImageCrop.parse('40')).toBe(ImageCrop.default);
      expect(ImageCrop.parse('40 20')).toBe(ImageCrop.default);
    });

    it('数値でない値は軸ごとの既定値に落とす', () => {
      let crop = ImageCrop.parse('abc xyz 2');

      expect(crop.x).toBe(50);
      expect(crop.y).toBe(0);
      expect(crop.scale).toBe(2);
    });

    it('範囲外の位置は 0〜100 にクランプする', () => {
      expect(ImageCrop.parse('-30 300 1').x).toBe(0);
      expect(ImageCrop.parse('-30 300 1').y).toBe(100);
    });

    it('範囲外の倍率は minScale〜maxScale にクランプする', () => {
      expect(ImageCrop.parse('50 0 0.1').scale).toBe(ImageCrop.minScale);
      expect(ImageCrop.parse('50 0 99').scale).toBe(ImageCrop.maxScale);
    });

    it('端数を丸める', () => {
      let crop = ImageCrop.parse('33.333333 66.666666 1.234567');

      expect(crop.x).toBe(33.3);
      expect(crop.y).toBe(66.7);
      expect(crop.scale).toBe(1.23);
    });
  });

  describe('toString', () => {
    it('既定値は空文字。属性を書かずに済ませるため', () => {
      expect(ImageCrop.default.toString()).toBe('');
    });

    it('parse と往復する', () => {
      let crop = new ImageCrop(33.3, 66.7, 1.23);

      expect(ImageCrop.parse(crop.toString()).x).toBe(33.3);
      expect(ImageCrop.parse(crop.toString()).y).toBe(66.7);
      expect(ImageCrop.parse(crop.toString()).scale).toBe(1.23);
    });
  });

  describe('CSS 値', () => {
    // 枠を覆わない枠（キャラクターシートのメイン画像）では倍率だけが効く
    it('既定値では拡大しない', () => {
      expect(ImageCrop.default.zoomTransform).toBe('none');
      expect(ImageCrop.default.anchorOrigin).toBe('50% 0%');
    });

    it('倍率が transform になる', () => {
      expect(new ImageCrop(40, 20, 2).zoomTransform).toBe('scale(2)');
    });

    /*
     * 枠を覆わせる配置。left/top は枠基準、translate は画像自身の大きさ基準で解決されるので、
     * 画像の (x%, y%) がちょうど枠の (x%, y%) に来る。cover 後のピクセル値は要らない。
     */
    it('既定値は枠の上辺中央に画像の上辺中央を合わせる', () => {
      expect(ImageCrop.default.coverLeft).toBe('50%');
      expect(ImageCrop.default.coverTop).toBe('0%');
      // -0 は文字列化すると符号が落ちる。CSS 的には 0% と -0% は同じなのでそのままでよい
      expect(ImageCrop.default.coverTransform).toBe('translate(-50%, 0%)');
    });

    it('拡大するときは引き戻しのあとに scale を並べる', () => {
      let crop = new ImageCrop(40, 20, 2);

      expect(crop.coverLeft).toBe('40%');
      expect(crop.coverTop).toBe('20%');
      expect(crop.coverTransform).toBe('translate(-40%, -20%) scale(2)');
    });

    // transform-origin を注目点に合わせないと、倍率を上げた時点で注目点がずれる
    it('回転中心は注目点と同じ', () => {
      expect(new ImageCrop(40, 20, 2).anchorOrigin).toBe('40% 20%');
    });
  });

  /*
   * 枠に合わせた側が 100%、もう片方が auto。逆にすると枠に隙間が空く。
   * 引数は (画像の幅, 画像の高さ, 枠の幅, 枠の高さ)。
   */
  describe('coverAxis', () => {
    it('画像の方が相対的に横長なら高さを合わせる', () => {
      expect(ImageCrop.coverAxis(200, 100, 100, 100)).toBe('height');
    });

    it('画像の方が相対的に縦長なら幅を合わせる', () => {
      expect(ImageCrop.coverAxis(100, 200, 100, 100)).toBe('width');
    });

    // 同じ正方形の画像でも、枠の縦横比しだいで合わせる軸が逆になる
    it('比べるのは枠との相対値で、画像単体の縦横比ではない', () => {
      expect(ImageCrop.coverAxis(100, 100, 100, 200)).toBe('height');
      expect(ImageCrop.coverAxis(100, 100, 200, 100)).toBe('width');
    });

    // 縦横比が一致するときはどちらでも覆えるので、幅側に倒れれば十分
    it('縦横比が枠と一致するなら幅を合わせる', () => {
      expect(ImageCrop.coverAxis(300, 300, 100, 100)).toBe('width');
      expect(ImageCrop.coverAxis(400, 200, 100, 50)).toBe('width');
    });

    // 読み込み前の画像は naturalWidth が 0。load を待って測り直すので、ここでは軸を決めない
    it('画像の寸法が無いうちは決めない', () => {
      expect(ImageCrop.coverAxis(0, 0, 100, 100)).toBeNull();
      expect(ImageCrop.coverAxis(100, 0, 100, 100)).toBeNull();
      expect(ImageCrop.coverAxis(NaN, 100, 100, 100)).toBeNull();
    });

    // 畳まれた枠（モーダルが開く前など）。表示されたら ResizeObserver が測り直す
    it('枠の寸法が無いうちは決めない', () => {
      expect(ImageCrop.coverAxis(100, 100, 0, 0)).toBeNull();
      expect(ImageCrop.coverAxis(100, 100, 100, 0)).toBeNull();
      expect(ImageCrop.coverAxis(100, 100, -1, 100)).toBeNull();
    });
  });

  describe('withX / withY', () => {
    it('触っていない軸と倍率は保つ', () => {
      let crop = new ImageCrop(40, 20, 2);

      expect([crop.withX(70).x, crop.withX(70).y, crop.withX(70).scale]).toEqual([70, 20, 2]);
      expect([crop.withY(70).x, crop.withY(70).y, crop.withY(70).scale]).toEqual([40, 70, 2]);
    });

    // スライダーは 0〜100 しか出さないが、値の正しさはモデル側で閉じておく
    it('範囲外は 0〜100 にクランプする', () => {
      let crop = new ImageCrop(40, 20, 2);

      expect(crop.withX(-10).x).toBe(0);
      expect(crop.withX(200).x).toBe(100);
      expect(crop.withY(-10).y).toBe(0);
      expect(crop.withY(200).y).toBe(100);
    });

    it('既定値へ戻る操作では共有インスタンスを返す', () => {
      expect(new ImageCrop(40, 0, 1).withX(50)).toBe(ImageCrop.default);
      expect(new ImageCrop(50, 20, 1).withY(0)).toBe(ImageCrop.default);
    });
  });

  describe('withScale', () => {
    it('注目点を保ったまま倍率だけ変える', () => {
      let crop = new ImageCrop(40, 20, 1).withScale(2.5);

      expect(crop.x).toBe(40);
      expect(crop.y).toBe(20);
      expect(crop.scale).toBe(2.5);
    });

    it('範囲外はクランプする', () => {
      expect(ImageCrop.default.withScale(0).scale).toBe(ImageCrop.minScale);
      expect(ImageCrop.default.withScale(10).scale).toBe(ImageCrop.maxScale);
    });
  });

  describe('pan', () => {
    it('はみ出している軸は、ドラッグした向きに中身が動く', () => {
      // 100x100 の枠に 200x100 の画像。cover 後も 200x100 で、横に 100px はみ出す
      let crop = ImageCrop.default.pan(10, 0, 100, 100, 200, 100);

      expect(crop.x).toBe(40);
    });

    // 短辺が枠にぴったり収まる軸には隠れた部分が無いので、動かしようがない
    it('はみ出していない軸は動かない', () => {
      let crop = ImageCrop.default.pan(0, 10, 100, 100, 200, 100);

      expect(crop.y).toBe(0);
    });

    it('拡大していれば、ぴったり収まっていた軸も動く', () => {
      // 100x100 の枠に 100x100 の画像を 2 倍。両軸とも 100px はみ出す
      let crop = ImageCrop.default.withScale(2).pan(10, -10, 100, 100, 100, 100);

      expect(crop.x).toBe(40);
      expect(crop.y).toBe(10);
    });

    it('はみ出し量が小さいほど大きく動く', () => {
      // 横に 400px はみ出す（= 動かせる幅が広い）ので、同じ 10px でも注目点の移動は小さい
      let crop = ImageCrop.default.pan(10, 0, 100, 100, 500, 100);

      expect(crop.x).toBe(47.5);
    });

    it('端を越えたらクランプする', () => {
      expect(ImageCrop.default.pan(1000, 0, 100, 100, 200, 100).x).toBe(0);
      expect(ImageCrop.default.pan(-1000, 0, 100, 100, 200, 100).x).toBe(100);
    });

    it('画像サイズが不明なうちは、等倍なら動かさない', () => {
      expect(ImageCrop.default.pan(10, 10, 100, 100, 0, 0)).toBe(ImageCrop.default);
    });

    // 読み込みが終わるまで動かせないと、モーダルを開いた直後の操作が死ぬ
    it('画像サイズが不明でも、拡大中は枠ぴったりの画像とみなして動く', () => {
      expect(ImageCrop.default.withScale(2).pan(10, 0, 100, 100, 0, 0).x).toBe(40);
    });

    it('既定値へ戻る操作では共有インスタンスを返す', () => {
      expect(ImageCrop.default.pan(0, 0, 100, 100, 200, 100)).toBe(ImageCrop.default);
    });
  });

  describe('DataElement との読み書き', () => {
    afterEach(resetGameObjects);

    function makeImageElement(): DataElement {
      return DataElement.create('imageIdentifier', '', { type: 'image' });
    }

    it('属性が無ければ既定値', () => {
      expect(ImageCrop.from(makeImageElement())).toBe(ImageCrop.default);
      expect(ImageCrop.from(null)).toBe(ImageCrop.default);
    });

    it('書いた値を読み戻せる', () => {
      let element = makeImageElement();
      ImageCrop.write(element, new ImageCrop(40, 20, 1.5));

      expect(ImageCrop.from(element).x).toBe(40);
      expect(ImageCrop.from(element).y).toBe(20);
      expect(ImageCrop.from(element).scale).toBe(1.5);
    });

    // 本家 Udonarium の XML を汚さないよう、調整していない画像には属性を残さない
    it('既定値を書くと属性ごと消える', () => {
      let element = makeImageElement();
      ImageCrop.write(element, new ImageCrop(40, 20, 1.5));
      ImageCrop.write(element, ImageCrop.default);

      expect(ImageCrop.sourceOf(element)).toBe('');
      expect(element.toXml()).not.toContain('imageCrop');
    });

    it('XML に属性として出る', () => {
      let element = makeImageElement();
      ImageCrop.write(element, new ImageCrop(40, 20, 1.5));

      expect(element.toXml()).toContain('imageCrop="40 20 1.5"');
    });
  });
});
