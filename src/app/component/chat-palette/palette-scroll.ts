/**
 * チャットパレットの select ⇔ textarea 差し替えで、表示中の先頭行を引き継ぐためのヘルパ。
 *
 * 閲覧用の select と編集用の textarea は *ngIf で入れ替わるため DOM ごと作り直され、scrollTop はそのたびに 0 に戻る。
 * ChatPalette.getPalette() は value を '\n' で split したものなので option のインデックスと textarea の論理行は 1:1 に対応する。
 * ピクセルではなく行番号で受け渡すことで、要素をまたいでも同じ行へ戻せる。
 *
 * textarea は折り返す設定なので、折り返しの起きた行より下では復元が多少ずれる。
 */

type PaletteElement = HTMLSelectElement | HTMLTextAreaElement;

/** 表示中の先頭行のインデックス。要素が無ければ 0 */
export function getPaletteTopLine(element: PaletteElement | null): number {
  if (!element) return 0;
  let lineHeight = getLineHeight(element);
  return 0 < lineHeight ? Math.round(element.scrollTop / lineHeight) : 0;
}

/** 指定した行が先頭に来るようスクロールさせる。範囲外は scrollTop 側でクランプされる */
export function scrollPaletteToLine(element: PaletteElement | null, line: number) {
  if (!element) return;
  let lineHeight = getLineHeight(element);
  if (lineHeight <= 0) return;
  element.scrollTop = line * lineHeight;
}

/** 1行あたりの高さ(px)。求まらなければ 0 */
function getLineHeight(element: PaletteElement): number {
  // select は行高が一定なので、全体の高さを option 数で割れば実測できる
  if (element instanceof HTMLSelectElement) {
    return 0 < element.options.length ? element.scrollHeight / element.options.length : 0;
  }
  let style = window.getComputedStyle(element);
  let lineHeight = parseFloat(style.lineHeight);
  // line-height: normal だと computed 値が 'normal' のままなので font-size から概算する
  if (Number.isNaN(lineHeight)) lineHeight = parseFloat(style.fontSize) * 1.2;
  return Number.isNaN(lineHeight) ? 0 : lineHeight;
}
