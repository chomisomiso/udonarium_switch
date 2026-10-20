import { DoublePressDetector } from '@udonarium/double-press';

describe('DoublePressDetector', () => {
  let detector: DoublePressDetector;

  beforeEach(() => {
    jasmine.clock().install();
    detector = new DoublePressDetector();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('同じ項目を続けて押したら2回目が true', () => {
    expect(detector.press(1)).toBe(false);
    expect(detector.press(1)).toBe(true);
  });

  // select は click より先に input が飛ぶので、選択状態と突き合わせると
  // 別の行を1回ずつ押しただけで送信されていた
  it('違う項目を続けて押しても true にならない', () => {
    detector.press(1);

    expect(detector.press(2)).toBe(false);
  });

  it('間隔内なら true', () => {
    detector.press(1);
    jasmine.clock().tick(399);

    expect(detector.press(1)).toBe(true);
  });

  it('間隔を過ぎたら次は1回目に戻る', () => {
    detector.press(1);
    jasmine.clock().tick(401);

    expect(detector.press(1)).toBe(false);
  });

  // 3回続けて押しても、2回目で成立した後は仕切り直しになる
  it('成立後はタイマーが解けている', () => {
    detector.press(1);
    detector.press(1);

    expect(detector.press(1)).toBe(false);
  });

  // 張り替え時に古いタイマーを解かないと、後から発火して構えを崩す
  it('別項目を挟んだ後も張り直しが効く', () => {
    detector.press(1);
    detector.press(2);

    expect(detector.press(2)).toBe(true);
  });

  it('cancel すると次は1回目に戻る', () => {
    detector.press(1);
    detector.cancel();

    expect(detector.press(1)).toBe(false);
  });

  describe('onSingle', () => {
    let onSingle: jasmine.Spy;

    beforeEach(() => onSingle = jasmine.createSpy('onSingle'));

    it('2回目が来ないまま間隔を過ぎたら1回だけ呼ぶ', () => {
      detector.press(1, onSingle);
      jasmine.clock().tick(399);
      expect(onSingle).not.toHaveBeenCalled();

      jasmine.clock().tick(2);
      expect(onSingle).toHaveBeenCalledTimes(1);
    });

    it('2回目が成立したら呼ばない', () => {
      detector.press(1, onSingle);
      detector.press(1, onSingle);
      jasmine.clock().tick(1000);

      expect(onSingle).not.toHaveBeenCalled();
    });

    // ダッシュボードでは A を押してすぐ B を押したら、選ぶのは B だけ
    it('別項目に張り替えたら前の項目のぶんは呼ばない', () => {
      let onSingleOther = jasmine.createSpy('onSingleOther');
      detector.press(1, onSingle);
      detector.press(2, onSingleOther);
      jasmine.clock().tick(1000);

      expect(onSingle).not.toHaveBeenCalled();
      expect(onSingleOther).toHaveBeenCalledTimes(1);
    });

    it('cancel したら呼ばない', () => {
      detector.press(1, onSingle);
      detector.cancel();
      jasmine.clock().tick(1000);

      expect(onSingle).not.toHaveBeenCalled();
    });

    // 呼ばれた時点で構えは解けており、続く1回は新しい1回目になる
    it('呼んだ後は1回目に戻る', () => {
      detector.press(1, onSingle);
      jasmine.clock().tick(401);

      expect(detector.press(1)).toBe(false);
    });
  });

  describe('間隔の指定', () => {
    beforeEach(() => detector = new DoublePressDetector(300));

    it('指定した間隔内なら true', () => {
      detector.press(1);
      jasmine.clock().tick(299);

      expect(detector.press(1)).toBe(true);
    });

    it('指定した間隔を過ぎたら1回目に戻る', () => {
      detector.press(1);
      jasmine.clock().tick(301);

      expect(detector.press(1)).toBe(false);
    });
  });
});
