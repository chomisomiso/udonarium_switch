/**
 * Firefox 向けの、テーブルに立てた面の解像度対策。
 *
 * Firefox はコマや地形の壁のようにテーブルに立てた面を低い倍率でラスタライズするため、
 * 視点を寄せると画像が極端に荒くなる（テーブルに寝ている面や、Chrome / Edge では起きない）。
 * レイアウト上は SCALE 倍の大きさで描き、`scale(1 / SCALE)` で元の見た目に縮めて解像度を確保する。
 *
 * filter / opacity / clip-path を持つ要素は中身を平面に焼き込むので、縮める側の要素に移さないと効かない。
 * 倍率を変えるときは styles.css と terrain.component.css の 400% / 0.25 も揃えること。
 */
export namespace FirefoxRasterScale {
  export const SCALE = 4;
  export const isEnabled: boolean = /firefox/i.test(window.navigator.userAgent);
}
