import { IPoint2D, Transform } from './transform';

/**
 * 矩形領域とDOM要素のオーバーラップ判定を行う。
 * CSS Transformによる回転を考慮し、SAT（分離軸定理）で精密判定する。
 */
export class RegionOverlapDetector {
  private latestDomRect: DOMRect;
  private latestRectPoints: IPoint2D[] = [];

  constructor(private element: HTMLElement) { }

  /**
   * 指定された矩形領域と要素が重なっているか判定する。
   * AABB粗判定 → DOMRectキャッシュ → SAT精密判定の順で処理する。
   */
  checkOverlap(region: { x: number, y: number, width: number, height: number }): boolean {
    let targetRect = this.element.getBoundingClientRect();

    // AABB粗判定
    let isMaybeOverlap = targetRect.x <= region.x + region.width
      && region.x <= targetRect.x + targetRect.width
      && targetRect.y <= region.y + region.height
      && region.y <= targetRect.y + targetRect.height;
    if (!isMaybeOverlap) return false;

    // DOMRectが変わっていれば頂点を再計算
    if (!this.isSameDomRect(targetRect)) {
      let points: IPoint2D[] = [
        { x: 0, y: 0 },
        { x: this.element.clientWidth, y: 0 },
        { x: this.element.clientWidth, y: this.element.clientHeight },
        { x: 0, y: this.element.clientHeight },
      ];
      let transformer: Transform = new Transform(this.element);
      this.latestDomRect = targetRect;
      this.latestRectPoints = points.map(point => transformer.localToGlobal(point.x, point.y));
      transformer.clear();
    }

    // SAT精密判定
    let rectA: IPoint2D[] = [
      { x: region.x, y: region.y },
      { x: region.x + region.width, y: region.y },
      { x: region.x + region.width, y: region.y + region.height },
      { x: region.x, y: region.y + region.height },
    ];
    return checkOverlapSAT(rectA, this.latestRectPoints);
  }

  private isSameDomRect(rect: DOMRect): boolean {
    return this.latestDomRect != null
      && this.latestDomRect.x === rect.x
      && this.latestDomRect.y === rect.y
      && this.latestDomRect.width === rect.width
      && this.latestDomRect.height === rect.height
      && this.latestDomRect.top === rect.top
      && this.latestDomRect.left === rect.left
      && this.latestDomRect.bottom === rect.bottom
      && this.latestDomRect.right === rect.right;
  }
}

function checkOverlapSAT(rectA: IPoint2D[], rectB: IPoint2D[]) {
  let edges = [...getEdges(rectA), ...getEdges(rectB)];

  for (let edge of edges) {
    let axis = { x: -edge.y, y: edge.x }; // 法線ベクトル
    let projA = projectOntoAxis(rectA, axis);
    let projB = projectOntoAxis(rectB, axis);

    let isProjectionsOverlap = !(projA.max < projB.min || projB.max < projA.min);
    if (!isProjectionsOverlap) return false;
  }

  return true; // すべての軸で投影が重なるなら接触している
}

function getEdges(points: IPoint2D[]): IPoint2D[] {
  let edges = [];
  for (let i = 0; i < points.length; i++) {
    let next = (i + 1) % points.length;
    edges.push({ x: points[next].x - points[i].x, y: points[next].y - points[i].y });
  }
  return edges;
}

function projectOntoAxis(points: IPoint2D[], axis: IPoint2D): { min: number, max: number } {
  let min = Infinity, max = -Infinity;
  for (let p of points) {
    let projection = (p.x * axis.x + p.y * axis.y);
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}
