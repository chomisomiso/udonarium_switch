import { MathUtil } from '../core/system/util/math-util';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/** #root（perspective origin）の中心を原点とするスクリーン座標 */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** テーブル平面（ローカル z = 0）上の点。回転の支点として使う */
export interface TabletopPoint {
  vx: number;
  vy: number;
}

/** テーブル画像の実寸(px) */
export interface TableSize {
  width: number;
  height: number;
}

/** 視点の平行移動と回転。GameTableComponent の viewPotison* / viewRotate* に対応する */
export interface CameraState {
  positionX: number;
  positionY: number;
  positionZ: number;
  /** 度 */
  rotateX: number;
  rotateY: number;
  rotateZ: number;
}

/**
 * テーブルの視点操作にまつわる計算。
 *
 * スクリーン座標からテーブル座標への変換は `Transform.globalToLocal`（CoordinateService 経由）にもあるが、
 * - clampRotateX / rotateAround は「DOM 未反映の state」で高さを解く必要があり、実 DOM を前提の Transform では原理的に扱えない
 * コマの座標計算など DOM が確定している場面では従来どおり CoordinateService を使うこと。
 */
export namespace TableCamera {
  /** .is-perspective の値と対応させる */
  export const PERSPECTIVE_DISTANCE = 1000;
  export const ROTATE_X_MIN = 0;
  export const ROTATE_X_MAX = 80;
  /** カメラのテーブル平面からの高さ（h）の下限。h < 0 はカメラが裏側に回り込んだ状態 */
  export const HEIGHT_MIN = 25;

  /** テーブル平面の法線 n = R·(0,0,1)。 */
  export function normal(state: CameraState): Vector3D {
    let sinX = Math.sin(MathUtil.radians(state.rotateX)), cosX = Math.cos(MathUtil.radians(state.rotateX));
    let sinY = Math.sin(MathUtil.radians(state.rotateY)), cosY = Math.cos(MathUtil.radians(state.rotateY));

    return { x: sinY * cosX, y: -sinX, z: cosY * cosX };
  }

  /**
   * カメラのテーブル平面からの高さ h = (C - t)·n。C=(0,0,d) は固定されたカメラ位置。
   * h > 0 ならカメラは表側にいる。平面上のどの点で測っても同じ値になる。
   */
  export function height(state: CameraState): number {
    let n = normal(state);

    return -state.positionX * n.x
      - state.positionY * n.y
      + (PERSPECTIVE_DISTANCE - state.positionZ) * n.z;
  }

  /**
   * h を下げる向きの移動量を h >= HEIGHT_MIN の範囲へ丸める。
   * @param gradient ∂h/∂delta。平行移動 t に対しては -n の各成分がそのまま勾配になる
   */
  function clampByHeight(state: CameraState, delta: number, gradient: number): number {
    if (Math.abs(gradient) < 1e-6) return delta;   // その軸では h が変わらない
    if (0 <= delta * gradient) return delta;       // h が上がる向きは制限しない

    let limit = (HEIGHT_MIN - height(state)) / gradient;   // h が下限に達する delta
    return gradient < 0 ? Math.min(delta, limit) : Math.max(delta, limit);
  }

  /** 横パン量を丸める。rotateY が 0 の間は h が変わらないので実質素通しになる */
  export function clampTransformX(state: CameraState, transformX: number): number {
    return clampByHeight(state, transformX, -normal(state).x);
  }

  /** 縦パン量を丸める。真上から見ているときは h が変わらない */
  export function clampTransformY(state: CameraState, transformY: number): number {
    return clampByHeight(state, transformY, -normal(state).y);
  }

  /** ズーム量を丸める。t.z を増やすとカメラがテーブル平面へ近づく */
  export function clampTransformZ(state: CameraState, transformZ: number): number {
    return clampByHeight(state, transformZ, -normal(state).z);
  }

  /** 傾き量を丸める。支点を固定したまま回すと h が変わるので、h >= HEIGHT_MIN を保てる角度の範囲を求める。
   */
  export function clampRotateX(state: CameraState, rotateX: number, fixedPoint: Vector3D): number {
    let sinY = Math.sin(MathUtil.radians(state.rotateY)), cosY = Math.cos(MathUtil.radians(state.rotateY));
    let a = fixedPoint.y;
    let b = -fixedPoint.x * sinY + (PERSPECTIVE_DISTANCE - fixedPoint.z) * cosY;

    let lowerLimit = ROTATE_X_MIN;
    let upperLimit = ROTATE_X_MAX;

    // 支点を軸に回したときの h は radius·cos(θ - center)。radius が下限に届かない場合は
    // どう回しても条件を満たせないので、高さ由来の制約は掛けない（操作不能にしないため）
    let radius = Math.sqrt(a * a + b * b);
    if (HEIGHT_MIN <= radius) {
      let center = MathUtil.degrees(Math.atan2(a, b));
      let half = MathUtil.degrees(Math.acos(HEIGHT_MIN / radius));
      lowerLimit = Math.max(lowerLimit, center - half);
      upperLimit = Math.min(upperLimit, center + half);
    }

    // 下限が上限を追い越すことがあり、そのときは上限が勝つ。
    // MathUtil.clamp は逆に下限が勝つので、ここでは使えない
    let rotated = Math.min(Math.max(state.rotateX + rotateX, lowerLimit), upperLimit);
    return rotated - state.rotateX;
  }

  /**
   * 回転行列 R = rotateY(ry)·rotateX(rx)·rotateZ(rz) の第1・第2列を返す。
   * 扱うのはテーブル平面（ローカル z=0）上の点だけなので第3列は不要。
   */
  export function rotationColumns(rotateX: number, rotateY: number, rotateZ: number): { c1: Vector3D, c2: Vector3D } {
    let sinX = Math.sin(MathUtil.radians(rotateX)), cosX = Math.cos(MathUtil.radians(rotateX));
    let sinY = Math.sin(MathUtil.radians(rotateY)), cosY = Math.cos(MathUtil.radians(rotateY));
    let sinZ = Math.sin(MathUtil.radians(rotateZ)), cosZ = Math.cos(MathUtil.radians(rotateZ));

    return {
      c1: {
        x: cosY * cosZ + sinY * sinX * sinZ,
        y: cosX * sinZ,
        z: -sinY * cosZ + cosY * sinX * sinZ,
      },
      c2: {
        x: -cosY * sinZ + sinY * sinX * cosZ,
        y: cosX * cosZ,
        z: sinY * sinZ + cosY * sinX * cosZ,
      },
    };
  }

  /**
   * anchor（テーブル平面上の点）が視点座標系で動かないように保ったまま回転させた状態を返す。
   * 回転前の anchor の位置を控えておき、回転後の平行移動量を逆算することで元の位置へ戻す。
   * 傾き量は clampRotateX で丸めるので、回した結果カメラが裏へ回り込むことはない。
   */
  export function rotateAround(state: CameraState, anchor: TabletopPoint,
    rotateX: number, rotateY: number, rotateZ: number): CameraState {
    let fixedPoint = toViewSpace(state, anchor);

    let rotated: CameraState = {
      ...state,
      rotateX: state.rotateX + clampRotateX(state, rotateX, fixedPoint),
      rotateY: state.rotateY + rotateY,
      rotateZ: state.rotateZ + rotateZ,
    };

    let { c1, c2 } = rotationColumns(rotated.rotateX, rotated.rotateY, rotated.rotateZ);
    return {
      ...rotated,
      positionX: fixedPoint.x - (c1.x * anchor.vx + c2.x * anchor.vy),
      positionY: fixedPoint.y - (c1.y * anchor.vx + c2.y * anchor.vy),
      positionZ: fixedPoint.z - (c1.z * anchor.vx + c2.z * anchor.vy),
    };
  }

  /** テーブル平面上の点を、現在の変形を適用した視点座標系での位置に写す */
  export function toViewSpace(state: CameraState, point: TabletopPoint): Vector3D {
    let { c1, c2 } = rotationColumns(state.rotateX, state.rotateY, state.rotateZ);

    return {
      x: c1.x * point.vx + c2.x * point.vy + state.positionX,
      y: c1.y * point.vx + c2.y * point.vy + state.positionY,
      z: c1.z * point.vx + c2.z * point.vy + state.positionZ,
    };
  }

  /**
   * 視点座標系の点をスクリーン座標へ射影する（CSS perspective と同じ式）。
   * tabletopPointAt はこの逆写像を解いている。
   */
  export function toScreen(view: Vector3D): ScreenPoint {
    let scale = PERSPECTIVE_DISTANCE / (PERSPECTIVE_DISTANCE - view.z);
    return { x: view.x * scale, y: view.y * scale };
  }

  const SCREEN_CENTER: ScreenPoint = { x: 0, y: 0 };
  const TABLE_CENTER: TabletopPoint = { vx: 0, vy: 0 };

  /**
   * スクリーン上の一点に対応するテーブル平面上の点を求める（視線と平面の交点）。screen を省略すると画面中心。
   * 解が求まらなければ画面中心で解き直し、それも駄目ならテーブル中心へ退避する。戻り値は必ずテーブル画像の内側。
   */
  export function tabletopPointAt(state: CameraState, table: TableSize, screen: ScreenPoint = SCREEN_CENTER): TabletopPoint {
    let point = solveTabletopPoint(state, screen)
      ?? solveTabletopPoint(state, SCREEN_CENTER)
      ?? TABLE_CENTER;

    return clampToTable(point, table);
  }

  /** 視線とテーブル平面の交点を解く。係数行列が退化する／交点が後方になる場合は null */
  function solveTabletopPoint(state: CameraState, screen: ScreenPoint): TabletopPoint | null {
    let { c1, c2 } = rotationColumns(state.rotateX, state.rotateY, state.rotateZ);
    let d = PERSPECTIVE_DISTANCE;
    let sx = screen.x, sy = screen.y;

    let a11 = d * c1.x + sx * c1.z, a12 = d * c2.x + sx * c2.z;
    let a21 = d * c1.y + sy * c1.z, a22 = d * c2.y + sy * c2.z;
    let b1 = sx * (d - state.positionZ) - d * state.positionX;
    let b2 = sy * (d - state.positionZ) - d * state.positionY;

    let det = a11 * a22 - a12 * a21;
    if (Math.abs(det) < 1e-6) return null;

    let point: TabletopPoint = {
      vx: (b1 * a22 - a12 * b2) / det,
      vy: (a11 * b2 - b1 * a21) / det,
    };

    // 視線がテーブル平面と交わらない
    if (d - 1e-6 <= toViewSpace(state, point).z) return null;

    return point;
  }

  /** テーブル画像の矩形へ丸める。#gameTable の transform-origin は要素中心なので範囲は ±寸法/2 */
  export function clampToTable(point: TabletopPoint, table: TableSize): TabletopPoint {
    let halfWidth = table.width / 2;
    let halfHeight = table.height / 2;

    return {
      vx: MathUtil.clamp(point.vx, -halfWidth, halfWidth),
      vy: MathUtil.clamp(point.vy, -halfHeight, halfHeight),
    };
  }
}
