import { MathUtil } from './math-util';

describe('MathUtil', () => {
  describe('clampMin', () => {
    it('下限を下回る値を下限に持ち上げる', () => {
      expect(MathUtil.clampMin(5, 10)).toBe(10);
      expect(MathUtil.clampMin(10, 10)).toBe(10);
      expect(MathUtil.clampMin(11, 10)).toBe(11);
    });

    it('下限の既定値は 0', () => {
      expect(MathUtil.clampMin(-5)).toBe(0);
      expect(MathUtil.clampMin(5)).toBe(5);
    });
  });

  describe('clampMax', () => {
    it('上限を上回る値を上限に切り下げる', () => {
      expect(MathUtil.clampMax(15, 10)).toBe(10);
      expect(MathUtil.clampMax(10, 10)).toBe(10);
      expect(MathUtil.clampMax(9, 10)).toBe(9);
    });

    it('上限の既定値は 100', () => {
      expect(MathUtil.clampMax(150)).toBe(100);
      expect(MathUtil.clampMax(50)).toBe(50);
    });
  });

  describe('clamp', () => {
    it('範囲内の値はそのまま返す', () => {
      expect(MathUtil.clamp(5, 0, 10)).toBe(5);
      expect(MathUtil.clamp(0, 0, 10)).toBe(0);
      expect(MathUtil.clamp(10, 0, 10)).toBe(10);
    });

    it('範囲外の値を境界に丸める', () => {
      expect(MathUtil.clamp(-1, 0, 10)).toBe(0);
      expect(MathUtil.clamp(11, 0, 10)).toBe(10);
    });

    it('負の範囲でも動作する', () => {
      expect(MathUtil.clamp(-5, -10, -1)).toBe(-5);
      expect(MathUtil.clamp(0, -10, -1)).toBe(-1);
      expect(MathUtil.clamp(-20, -10, -1)).toBe(-10);
    });

    // clampMin(clampMax(v, max), min) の順で適用するため min が後勝ちになる。
    // GameCharacter.imageIndex が画像 0 枚のとき clamp(x, 0, -1) を呼ぶので、この挙動に依存している
    it('min > max の逆転範囲では min が勝つ', () => {
      expect(MathUtil.clamp(5, 0, -1)).toBe(0);
      expect(MathUtil.clamp(-3, 0, -1)).toBe(0);
      expect(MathUtil.clamp(0, 0, -1)).toBe(0);
    });

    // NaN < max が false のため clampMax が max を返し、そのまま通過する
    it('NaN は max に落ちる', () => {
      expect(MathUtil.clamp(NaN, 0, 10)).toBe(10);
    });
  });

  describe('sqrMagnitude', () => {
    it('原点からの距離の二乗を返す', () => {
      expect(MathUtil.sqrMagnitude({ x: 3, y: 4 })).toBe(25);
      expect(MathUtil.sqrMagnitude({ x: 1, y: 2, z: 2 })).toBe(9);
    });

    it('2 点間の距離の二乗を返す', () => {
      expect(MathUtil.sqrMagnitude({ x: 4, y: 6 }, { x: 1, y: 2 })).toBe(25);
    });

    it('z の省略は 0 として扱う', () => {
      expect(MathUtil.sqrMagnitude({ x: 0, y: 0, z: 3 }, { x: 0, y: 0 })).toBe(9);
      expect(MathUtil.sqrMagnitude({ x: 0, y: 0 }, { x: 0, y: 0, z: 3 })).toBe(9);
    });
  });

  describe('radians / degrees', () => {
    it('度とラジアンを相互変換する', () => {
      expect(MathUtil.radians(180)).toBeCloseTo(Math.PI, 10);
      expect(MathUtil.degrees(Math.PI)).toBeCloseTo(180, 10);
      expect(MathUtil.radians(0)).toBe(0);
    });

    it('往復して元の値に戻る', () => {
      expect(MathUtil.degrees(MathUtil.radians(45))).toBeCloseTo(45, 10);
    });
  });
});
