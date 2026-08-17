/**
 * チャットパレットの select ⇔ textarea 差し替えで、表示中の先頭行を引き継ぐためのヘルパ。
 * 索引ジャンプ（palette-index.ts）の着地先の指定にも使う。
 *
 * 閲覧用の select と編集用の textarea は *ngIf で入れ替わるため DOM ごと作り直され、scrollTop はそのたびに 0 に戻る。
 * ChatPalette.getPalette() は value を '\n' で split したものなので option のインデックスと textarea の論理行は 1:1 に対応する。
 * ピクセルではなく行番号で受け渡すことで、要素をまたいでも同じ行へ戻せる。
 *
 * select は option の実物の位置で合わせる。行高が一定でないため（空行の option は文字のある行より低い）、
 * 平均行高から座標を割り出すと空行の偏りぶんだけズレて、下の行ほど大きく外れる。
 * textarea は折り返す設定なので、折り返しの起きた行より下では復元が多少ずれる。
 */

type PaletteElement = HTMLSelectElement | HTMLTextAreaElement;

/** 表示中の先頭行のインデックス。要素が無ければ 0 */
export function getPaletteTopLine(element: PaletteElement | null): number {
  if (!element) return 0;
  if (element instanceof HTMLSelectElement) return getSelectTopLine(element);
  let lineHeight = getLineHeight(element);
  return 0 < lineHeight ? Math.round(element.scrollTop / lineHeight) : 0;
}

/** 指定した行が先頭に来るようスクロールさせる。範囲外は scrollTop 側でクランプされる */
export function scrollPaletteToLine(element: PaletteElement | null, line: number) {
  if (!element) return;
  if (element instanceof HTMLSelectElement) return scrollSelectToLine(element, line);
  let lineHeight = getLineHeight(element);
  if (lineHeight <= 0) return;
  element.scrollTop = line * lineHeight;
}

/** 中身（border と padding の内側）の上端。option の位置を比べる基準 */
function getContentTop(element: HTMLSelectElement): number {
  let style = window.getComputedStyle(element);
  return element.getBoundingClientRect().top
    + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
}

/** option を中身の上端へ寄せる。rect は現在のスクロール位置からの相対なので、どこから呼んでも1回で合う */
function scrollSelectToLine(element: HTMLSelectElement, line: number) {
  if (element.options.length < 1) return;
  let option = element.options[Math.min(Math.max(line, 0), element.options.length - 1)];
  element.scrollTop += option.getBoundingClientRect().top - getContentTop(element);
}

/** 中身の上端にかかっている option のインデックス */
function getSelectTopLine(element: HTMLSelectElement): number {
  let contentTop = getContentTop(element);
  for (let i = 0; i < element.options.length; i++) {
    // ぴったり上端で終わる option を先頭と数えないよう、端数ぶんの遊びを持たせる
    if (contentTop < element.options[i].getBoundingClientRect().bottom - 1) return i;
  }
  return 0;
}

/** 1行あたりの高さ(px)。求まらなければ 0 */
function getLineHeight(element: HTMLTextAreaElement): number {
  let style = window.getComputedStyle(element);
  let lineHeight = parseFloat(style.lineHeight);
  // line-height: normal だと computed 値が 'normal' のままなので font-size から概算する
  if (Number.isNaN(lineHeight)) lineHeight = parseFloat(style.fontSize) * 1.2;
  return Number.isNaN(lineHeight) ? 0 : lineHeight;
}
