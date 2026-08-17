import { MathUtil } from '@udonarium/core/system/util/math-util';
import { CameraState, TableCamera, TableSize, TabletopPoint, Vector3D } from '@udonarium/transform/table-camera';

/**
 * 視点計算の検証。誤りが「壊れる」ではなく「なんとなく視点が変」として現れる領域なので、
 * 既知の値だけでなく数学的な性質（正規直交性・逆写像の往復）でも縛る。
 */
describe('TableCamera', () => {
  const D = TableCamera.PERSPECTIVE_DISTANCE;

  /** クランプが効かないだけの十分に広いテーブル */
  const HUGE_TABLE: TableSize = { width: 1e6, height: 1e6 };

  function state(overrides: Partial<CameraState> = {}): CameraState {
    return {
      positionX: 0, positionY: 0, positionZ: 0,
      rotateX: 0, rotateY: 0, rotateZ: 0,
      ...overrides,
    };
  }

  /** GameTableComponent の初期姿勢 */
  const DEFAULT_STATE = state({ positionX: 100, rotateX: 50, rotateZ: 10 });

  function magnitude(v: Vector3D): number {
    return Math.sqrt(MathUtil.sqrMagnitude(v));
  }

  function dot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  describe('rotationColumns', () => {
    it('無回転なら単位ベクトルを返す', () => {
      let { c1, c2 } = TableCamera.rotationColumns(0, 0, 0);

      expect(c1.x).toBeCloseTo(1, 10);
      expect(c1.y).toBeCloseTo(0, 10);
      expect(c1.z).toBeCloseTo(0, 10);
      expect(c2.x).toBeCloseTo(0, 10);
      expect(c2.y).toBeCloseTo(1, 10);
      expect(c2.z).toBeCloseTo(0, 10);
    });

    // 回転行列の列なので常に正規直交。符号や項の取り違えはここで落ちる
    it('どの角度でも正規直交である', () => {
      let angles: [number, number, number][] = [
        [0, 0, 0], [50, 0, 10], [85, 0, 0], [30, 45, 60],
        [-20, 170, 200], [80, -35, -100], [12.5, 0.5, 359],
      ];

      for (let [rx, ry, rz] of angles) {
        let { c1, c2 } = TableCamera.rotationColumns(rx, ry, rz);
        let label = `(${rx}, ${ry}, ${rz})`;

        expect(magnitude(c1)).withContext('|c1| ' + label).toBeCloseTo(1, 10);
        expect(magnitude(c2)).withContext('|c2| ' + label).toBeCloseTo(1, 10);
        expect(dot(c1, c2)).withContext('c1·c2 ' + label).toBeCloseTo(0, 10);
      }
    });

    it('Z 回転だけなら平面内の回転になる', () => {
      let { c1, c2 } = TableCamera.rotationColumns(0, 0, 90);

      expect(c1.z).toBeCloseTo(0, 10);
      expect(c2.z).toBeCloseTo(0, 10);
      expect(c1.x).toBeCloseTo(0, 10);
      expect(c1.y).toBeCloseTo(1, 10);
      expect(c2.x).toBeCloseTo(-1, 10);
      expect(c2.y).toBeCloseTo(0, 10);
    });
  });

  describe('height', () => {
    it('真上から見ているときは perspective 距離そのもの', () => {
      expect(TableCamera.height(state())).toBeCloseTo(D, 6);
      expect(TableCamera.height(state({ positionZ: 200 }))).toBeCloseTo(D - 200, 6);
    });

    it('傾けるとその余弦だけ低くなる', () => {
      expect(TableCamera.height(state({ rotateX: 50 }))).toBeCloseTo(D * Math.cos(Math.PI * 50 / 180), 6);
    });

    it('Y 回転が無ければ positionX は高さに影響しない', () => {
      expect(TableCamera.height(state({ rotateX: 50, positionX: 100 })))
        .toBeCloseTo(TableCamera.height(state({ rotateX: 50 })), 6);
    });

    // 実装は position だけで h を求めている。これはテーブル平面上のどの点で測っても同じ値になる（法線と c1/c2 が直交する）ことを前提にしている
    it('平面上のどの点で測っても同じ値になる', () => {
      let target = state({ positionX: -120, positionY: 80, positionZ: -50, rotateX: 55, rotateY: 20, rotateZ: 15 });
      let sinX = Math.sin(Math.PI * 55 / 180), cosX = Math.cos(Math.PI * 55 / 180);
      let sinY = Math.sin(Math.PI * 20 / 180), cosY = Math.cos(Math.PI * 20 / 180);
      let normal: Vector3D = { x: sinY * cosX, y: -sinX, z: cosY * cosX };

      for (let point of [{ vx: 0, vy: 0 }, { vx: 300, vy: -200 }, { vx: -1000, vy: 750 }]) {
        let view = TableCamera.toViewSpace(target, point);
        // カメラは (0, 0, D) に固定されている
        let measured = dot({ x: -view.x, y: -view.y, z: D - view.z }, normal);

        expect(measured).withContext(JSON.stringify(point)).toBeCloseTo(TableCamera.height(target), 6);
      }
    });
  });

  describe('normal', () => {
    it('真上から見ているときはカメラ方向を向く', () => {
      let n = TableCamera.normal(state());

      expect(n.x).toBeCloseTo(0, 10);
      expect(n.y).toBeCloseTo(0, 10);
      expect(n.z).toBeCloseTo(1, 10);
    });

    it('常に単位ベクトル', () => {
      for (let [rx, ry] of [[0, 0], [50, 0], [80, 0], [30, 45], [-20, 170], [120, -95]]) {
        expect(magnitude(TableCamera.normal(state({ rotateX: rx, rotateY: ry }))))
          .withContext(`(${rx}, ${ry})`).toBeCloseTo(1, 10);
      }
    });

    // 平面の法線なので、平面を張る c1 / c2 とは直交する
    it('rotationColumns の 2 列と直交する', () => {
      let target = state({ rotateX: 55, rotateY: 20, rotateZ: 15 });
      let { c1, c2 } = TableCamera.rotationColumns(target.rotateX, target.rotateY, target.rotateZ);
      let n = TableCamera.normal(target);

      expect(dot(n, c1)).toBeCloseTo(0, 10);
      expect(dot(n, c2)).toBeCloseTo(0, 10);
    });
  });

  describe('clampTransformX', () => {
    // ∂h/∂t.x = -sinY·cosX。ジェスチャ層は rotateY を動かさないので現状は常に素通しになる
    it('Y 回転が無ければ高さが変わらないので素通しする', () => {
      expect(TableCamera.clampTransformX(state({ rotateX: 50 }), 5000)).toBe(5000);
      expect(TableCamera.clampTransformX(state({ rotateX: 50 }), -5000)).toBe(-5000);
    });

    it('Y 回転があると下限で止まる', () => {
      let target = state({ rotateX: 50, rotateY: 30 });
      let clamped = TableCamera.clampTransformX(target, 100000);

      expect(TableCamera.height({ ...target, positionX: target.positionX + clamped }))
        .toBeCloseTo(TableCamera.HEIGHT_MIN, 6);
    });
  });

  describe('clampTransformZ', () => {
    it('高さに余裕があれば素通しする', () => {
      expect(TableCamera.clampTransformZ(state(), 500)).toBe(500);
    });

    it('引く方向は制限しない', () => {
      expect(TableCamera.clampTransformZ(state({ positionZ: 990 }), -100)).toBe(-100);
    });

    it('寄りすぎる分を下限ちょうどで止める', () => {
      let target = state();
      let clamped = TableCamera.clampTransformZ(target, 5000);

      expect(clamped).toBeCloseTo(D - TableCamera.HEIGHT_MIN, 6);
      expect(TableCamera.height({ ...target, positionZ: target.positionZ + clamped }))
        .toBeCloseTo(TableCamera.HEIGHT_MIN, 6);
    });

    // 既に下限を割っている状態からは負の値を返し、下限まで押し戻す
    it('下限を割っていれば押し戻す', () => {
      let target = state({ positionZ: 990 });   // h = 10
      let clamped = TableCamera.clampTransformZ(target, 100);

      expect(clamped).toBeLessThan(0);
      expect(TableCamera.height({ ...target, positionZ: target.positionZ + clamped }))
        .toBeCloseTo(TableCamera.HEIGHT_MIN, 6);
    });

    it('真横を向いていて高さが変わらないなら素通しする', () => {
      expect(TableCamera.clampTransformZ(state({ rotateY: 90 }), 500)).toBe(500);
    });
  });

  describe('clampTransformY', () => {
    it('高さが増える向きは制限しない', () => {
      expect(TableCamera.clampTransformY(state({ rotateX: 50 }), 500)).toBe(500);
    });

    it('高さに余裕があれば素通しする', () => {
      expect(TableCamera.clampTransformY(state({ rotateX: 50 }), -100)).toBe(-100);
    });

    it('下がりすぎる分を下限ちょうどで止める', () => {
      let target = state({ rotateX: 50 });
      let clamped = TableCamera.clampTransformY(target, -5000);

      expect(TableCamera.height({ ...target, positionY: target.positionY + clamped }))
        .toBeCloseTo(TableCamera.HEIGHT_MIN, 6);
    });

    it('真上から見ているときはパンしても高さが変わらないので素通しする', () => {
      expect(TableCamera.clampTransformY(state(), -5000)).toBe(-5000);
    });
  });

  describe('clampRotateX', () => {
    /** 無回転の視点では b = D - fixedPoint.z、a = fixedPoint.y になる */
    function fixedPoint(y: number, z: number): Vector3D {
      return { x: 0, y: y, z: z };
    }

    it('上限 ROTATE_X_MAX を超えない', () => {
      expect(TableCamera.clampRotateX(state(), 200, fixedPoint(0, 0))).toBeCloseTo(TableCamera.ROTATE_X_MAX, 6);
    });

    it('下限 ROTATE_X_MIN を下回らない', () => {
      expect(TableCamera.clampRotateX(state({ rotateX: 30 }), -200, fixedPoint(0, 0)))
        .toBeCloseTo(TableCamera.ROTATE_X_MIN - 30, 6);
    });

    it('範囲内なら要求どおり回す', () => {
      expect(TableCamera.clampRotateX(state(), 30, fixedPoint(0, 0))).toBeCloseTo(30, 6);
    });

    // 支点が近いほど、傾けたときに高さが下限を割りやすくなるので可動域が狭まる
    it('支点が近いと上限が高さ制約で狭まる', () => {
      // radius = 50、acos(25/50) = 60度 なので上限は ROTATE_X_MAX ではなく 60 になる
      let clamped = TableCamera.clampRotateX(state(), 200, fixedPoint(0, D - 50));

      expect(clamped).toBeCloseTo(60, 6);
      expect(clamped).toBeLessThan(TableCamera.ROTATE_X_MAX);
    });

    // radius < HEIGHT_MIN ではどう回しても条件を満たせない。
    // 操作不能にしないため、高さ由来の制約は掛けず UX 上のキャップだけが残る
    it('支点が近すぎて条件を満たせないときは高さ制約を落とす', () => {
      expect(TableCamera.clampRotateX(state(), 200, fixedPoint(0, D - 10)))
        .toBeCloseTo(TableCamera.ROTATE_X_MAX, 6);
    });

    it('半径が下限ちょうどなら可動域が一点に潰れる', () => {
      expect(TableCamera.clampRotateX(state({ rotateX: 40 }), 30, fixedPoint(0, D - TableCamera.HEIGHT_MIN)))
        .toBeCloseTo(-40, 6);
    });

    // center - half が上限を追い越すと下限 > 上限になる。
    // Math.min(Math.max(...)) はこのとき上限を採るため、MathUtil.clamp とは結果が異なる
    it('下限が上限を追い越したときは上限が勝つ', () => {
      // radius = 30、center = 120度、half = acos(25/30) ≒ 33.6度 → 下限 86.4 > 上限（ROTATE_X_MAX）
      let clamped = TableCamera.clampRotateX(state(), 200, fixedPoint(30 * Math.sin(Math.PI * 2 / 3), D + 15));

      expect(clamped).toBeCloseTo(TableCamera.ROTATE_X_MAX, 6);
    });
  });

  describe('toScreen', () => {
    it('カメラ平面に近いほど大きく写る', () => {
      expect(TableCamera.toScreen({ x: 100, y: 50, z: 0 })).toEqual({ x: 100, y: 50 });
      expect(TableCamera.toScreen({ x: 100, y: 50, z: 500 })).toEqual({ x: 200, y: 100 });
      expect(TableCamera.toScreen({ x: 100, y: 50, z: -1000 })).toEqual({ x: 50, y: 25 });
      expect(TableCamera.toScreen({ x: 0, y: 0, z: 300 })).toEqual({ x: 0, y: 0 });
    });
  });

  /**
   * tabletopPointAt は toViewSpace → toScreen の逆写像。
   * 連立方程式の解や射影の符号・添字の取り違えはこの往復で確実に落ちる。
   */
  describe('tabletopPointAt - 逆写像の往復', () => {
    const STATES: { label: string, value: CameraState }[] = [
      { label: '無回転', value: state() },
      { label: '初期姿勢', value: DEFAULT_STATE },
      { label: '傾き大', value: state({ rotateX: 80 }) },
      { label: 'Y 回転あり', value: state({ rotateX: 50, rotateY: 30, rotateZ: 10 }) },
      { label: '平行移動あり', value: state({ positionX: -200, positionY: 150, positionZ: -300, rotateX: 45, rotateY: 15, rotateZ: 5 }) },
    ];
    const POINTS: TabletopPoint[] = [
      { vx: 0, vy: 0 }, { vx: 100, vy: 50 }, { vx: -300, vy: 200 }, { vx: 250, vy: -150 },
    ];

    it('平面上の点を射影して解き直すと元に戻る', () => {
      for (let { label, value } of STATES) {
        for (let point of POINTS) {
          let screen = TableCamera.toScreen(TableCamera.toViewSpace(value, point));
          let restored = TableCamera.tabletopPointAt(value, HUGE_TABLE, screen);
          let context = `${label} / ${JSON.stringify(point)}`;

          expect(restored.vx).withContext('vx ' + context).toBeCloseTo(point.vx, 6);
          expect(restored.vy).withContext('vy ' + context).toBeCloseTo(point.vy, 6);
        }
      }
    });

    it('screen が null なら画面中心を指定したのと同じ', () => {
      for (let { label, value } of STATES) {
        let center = TableCamera.tabletopPointAt(value, HUGE_TABLE, { x: 0, y: 0 });
        let omitted = TableCamera.tabletopPointAt(value, HUGE_TABLE);

        expect(omitted.vx).withContext('vx ' + label).toBeCloseTo(center.vx, 6);
        expect(omitted.vy).withContext('vy ' + label).toBeCloseTo(center.vy, 6);
      }
    });
  });

  describe('tabletopPointAt - 解が求まらない場合', () => {
    // rotateX = 90 では平面が視線と平行になり、画面中央の行では係数行列が退化する
    it('行列式が退化したらテーブル中心へ退避する', () => {
      let restored = TableCamera.tabletopPointAt(state({ rotateX: 90 }), HUGE_TABLE, { x: 100, y: 0 });

      expect(restored.vx).toBeCloseTo(0, 6);
      expect(restored.vy).toBeCloseTo(0, 6);
    });

    it('視線がテーブル平面と交わらなければテーブル中心へ退避する', () => {
      // 平面がカメラ（z = D）より奥にあると交点が後方になる
      let restored = TableCamera.tabletopPointAt(state({ positionZ: D + 500 }), HUGE_TABLE, { x: 200, y: 100 });

      expect(restored.vx).toBeCloseTo(0, 6);
      expect(restored.vy).toBeCloseTo(0, 6);
    });

    // 退避は「画面中心で解き直す → それも駄目ならテーブル中心」の二段。
    // screen を省略した呼び出しでも解けないときは終端のテーブル中心に落ちる
    it('画面中心でも解けなければテーブル中心を返す', () => {
      let restored = TableCamera.tabletopPointAt(state({ positionZ: D + 500 }), HUGE_TABLE);

      expect(restored.vx).toBeCloseTo(0, 6);
      expect(restored.vy).toBeCloseTo(0, 6);
    });

    it('解けない場合でもテーブル矩形の内側へ丸めて返す', () => {
      // 画面の隅を指しても支点はテーブル画像からはみ出さない
      for (let screen of [{ x: 5000, y: 5000 }, { x: -5000, y: 3000 }, { x: 0, y: -4000 }]) {
        let point = TableCamera.tabletopPointAt(DEFAULT_STATE, { width: 200, height: 100 }, screen);

        expect(Math.abs(point.vx)).withContext(JSON.stringify(screen)).toBeLessThanOrEqual(100);
        expect(Math.abs(point.vy)).withContext(JSON.stringify(screen)).toBeLessThanOrEqual(50);
      }
    });
  });

  /**
   * 支点固定回転。回転の前後で支点の視点座標が変わらないことが定義そのもの。
   * 切り出し前はコンポーネント側にあってテストできなかった箇所。
   */
  describe('rotateAround', () => {
    const ANCHORS: TabletopPoint[] = [{ vx: 0, vy: 0 }, { vx: 200, vy: -120 }, { vx: -450, vy: 300 }];

    it('支点の視点座標が回転前後で変わらない', () => {
      for (let target of [DEFAULT_STATE, state({ positionX: -80, positionY: 40, rotateX: 30, rotateY: 20, rotateZ: -15 })]) {
        for (let anchor of ANCHORS) {
          for (let [rx, ry, rz] of [[10, 0, 0], [0, 25, 0], [0, 0, 40], [5, -10, 15]]) {
            let before = TableCamera.toViewSpace(target, anchor);
            let after = TableCamera.toViewSpace(TableCamera.rotateAround(target, anchor, rx, ry, rz), anchor);
            let context = `${JSON.stringify(anchor)} / (${rx}, ${ry}, ${rz})`;

            expect(after.x).withContext('x ' + context).toBeCloseTo(before.x, 6);
            expect(after.y).withContext('y ' + context).toBeCloseTo(before.y, 6);
            expect(after.z).withContext('z ' + context).toBeCloseTo(before.z, 6);
          }
        }
      }
    });

    it('回転量がそのまま加算される', () => {
      let rotated = TableCamera.rotateAround(DEFAULT_STATE, { vx: 0, vy: 0 }, 10, 25, -40);

      expect(rotated.rotateX).toBeCloseTo(DEFAULT_STATE.rotateX + 10, 6);
      expect(rotated.rotateY).toBeCloseTo(DEFAULT_STATE.rotateY + 25, 6);
      expect(rotated.rotateZ).toBeCloseTo(DEFAULT_STATE.rotateZ - 40, 6);
    });

    // 傾きは clampRotateX を通るので、要求どおりに回るとは限らない
    it('傾きは可動域へ丸められる', () => {
      let rotated = TableCamera.rotateAround(DEFAULT_STATE, { vx: 0, vy: 0 }, 500, 0, 0);

      expect(rotated.rotateX).toBeCloseTo(TableCamera.ROTATE_X_MAX, 6);
    });

    it('元の状態を書き換えない', () => {
      let target = state({ rotateX: 40 });
      let snapshot = { ...target };

      TableCamera.rotateAround(target, { vx: 100, vy: 100 }, 10, 10, 10);

      expect(target).toEqual(snapshot);
    });
  });

  describe('clampToTable', () => {
    const TABLE: TableSize = { width: 200, height: 100 };

    it('矩形の内側はそのまま', () => {
      expect(TableCamera.clampToTable({ vx: 50, vy: -30 }, TABLE)).toEqual({ vx: 50, vy: -30 });
    });

    it('矩形の外は縁へ丸める', () => {
      expect(TableCamera.clampToTable({ vx: 500, vy: 500 }, TABLE)).toEqual({ vx: 100, vy: 50 });
      expect(TableCamera.clampToTable({ vx: -500, vy: -500 }, TABLE)).toEqual({ vx: -100, vy: -50 });
    });

    // 寸法 0 のテーブルでは行き先が中心しかない
    it('寸法が未設定なら常に中心', () => {
      let clamped = TableCamera.clampToTable({ vx: 500, vy: -500 }, { width: 0, height: 0 });

      expect(clamped.vx).toBeCloseTo(0, 10);
      expect(clamped.vy).toBeCloseTo(0, 10);
    });

    it('負の座標も対称に丸める', () => {
      for (let point of [{ vx: 101, vy: 51 }, { vx: -101, vy: -51 }]) {
        let clamped = TableCamera.clampToTable(point, TABLE);

        expect(Math.abs(clamped.vx)).withContext(JSON.stringify(point)).toBe(100);
        expect(Math.abs(clamped.vy)).withContext(JSON.stringify(point)).toBe(50);
      }
    });
  });
});
