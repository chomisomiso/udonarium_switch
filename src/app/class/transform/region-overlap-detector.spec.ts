import { RegionOverlapDetector } from './region-overlap-detector';

/**
 * SAT 判定は要素の実レイアウトと CSS Transform に依存するので、
 * 実 DOM に要素を置いて外形から検証する。
 * body の余白は既定値がブラウザ依存なので 0 に固定してから座標を組み立てる。
 */
describe('RegionOverlapDetector', () => {
  let element: HTMLElement;
  let bodyMargin: string;

  beforeEach(() => {
    bodyMargin = document.body.style.margin;
    document.body.style.margin = '0';

    element = document.createElement('div');
    // 中心 (250, 250)、辺 100 の正方形
    element.style.cssText = 'position: absolute; left: 200px; top: 200px; width: 100px; height: 100px; margin: 0; padding: 0; border: 0;';
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
    document.body.style.margin = bodyMargin;
  });

  describe('回転していない矩形', () => {
    it('重なっていれば true', () => {
      let detector = new RegionOverlapDetector(element);
      expect(detector.checkOverlap({ x: 250, y: 250, width: 100, height: 100 })).toBe(true);
    });

    it('完全に内包していれば true', () => {
      let detector = new RegionOverlapDetector(element);
      expect(detector.checkOverlap({ x: 0, y: 0, width: 1000, height: 1000 })).toBe(true);
    });

    it('完全に内包されていれば true', () => {
      let detector = new RegionOverlapDetector(element);
      expect(detector.checkOverlap({ x: 240, y: 240, width: 10, height: 10 })).toBe(true);
    });

    it('離れていれば false', () => {
      let detector = new RegionOverlapDetector(element);
      expect(detector.checkOverlap({ x: 400, y: 400, width: 50, height: 50 })).toBe(false);
      expect(detector.checkOverlap({ x: 0, y: 0, width: 50, height: 50 })).toBe(false);
    });

    it('辺が接している状態は重なりとして扱う', () => {
      let detector = new RegionOverlapDetector(element);
      expect(detector.checkOverlap({ x: 300, y: 200, width: 50, height: 100 })).toBe(true);
    });
  });

  describe('45 度回転した矩形', () => {
    beforeEach(() => {
      element.style.transform = 'rotate(45deg)';
    });

    // 回転後の外接矩形は [179.3, 320.7] の正方形だが、実体は対角 141.4 のひし形。
    // AABB の粗判定だけでは true になる位置で false を返せることが SAT を入れている理由
    it('外接矩形の角はひし形の外なので false', () => {
      let detector = new RegionOverlapDetector(element);
      expect(detector.checkOverlap({ x: 180, y: 180, width: 8, height: 8 })).toBe(false);
    });

    it('ひし形の頂点付近は true', () => {
      let detector = new RegionOverlapDetector(element);
      expect(detector.checkOverlap({ x: 245, y: 175, width: 10, height: 10 })).toBe(true);
    });

    it('中心付近は true', () => {
      let detector = new RegionOverlapDetector(element);
      expect(detector.checkOverlap({ x: 245, y: 245, width: 10, height: 10 })).toBe(true);
    });

    it('外接矩形の外は AABB 粗判定で false', () => {
      let detector = new RegionOverlapDetector(element);
      expect(detector.checkOverlap({ x: 400, y: 400, width: 50, height: 50 })).toBe(false);
    });
  });
});
