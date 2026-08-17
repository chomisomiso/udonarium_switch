import { MathUtil } from './core/system/util/math-util';
import { DataElement } from './data-element';

/** 表示調整を持たせる DataElement の属性名 */
const ATTRIBUTE_NAME = 'imageCrop';

const DEFAULT_X = 50;
const DEFAULT_Y = 0;
const DEFAULT_SCALE = 1;

/** 枠を覆わせるとき、枠に合わせる側の軸 */
export type CoverAxis = 'width' | 'height';

/**
 * 画像を枠に収めるときの切り抜き方。
 *
 * 「画像の (x%, y%) の点を枠の (x%, y%) の位置に固定し、その点を中心に scale 倍する」と定義する。
 *
 * CSS へは object-fit を使わずに落とす。
 * Chromium の GPU ラスタライズ経路では、object-fit 経由で大きく縮小した画像にジャギーが出るため。
 * 既定値 (50, 0, 1) は `object-fit: cover; object-position: 50% 0%` と同じ見え方になる。
 */
export class ImageCrop {
  static readonly minScale: number = 1.0;
  static readonly maxScale: number = 4.0;

  private static _default: ImageCrop;
  /**
   * 未調整の画像はすべてこのインスタンスを共有する（変更検知のたびに作らないため）。
   * static フィールドで持つとクラス束縛が出来上がる前にコンストラクタが走り、
   * クランプ側から minScale を参照した時点で TDZ に落ちるので、生成は初回参照まで遅らせる。
   */
  static get default(): ImageCrop { return ImageCrop._default ??= new ImageCrop(DEFAULT_X, DEFAULT_Y, DEFAULT_SCALE); }

  readonly x: number;
  readonly y: number;
  readonly scale: number;

  constructor(x: number, y: number, scale: number) {
    this.x = clampPercent(x, DEFAULT_X);
    this.y = clampPercent(y, DEFAULT_Y);
    this.scale = clampScale(scale);
  }

  get isDefault(): boolean {
    return this.x === DEFAULT_X && this.y === DEFAULT_Y && this.scale === DEFAULT_SCALE;
  }

  /**
   * transform-origin に入れる注目点。拡大の中心をここに据えることで、倍率を変えても注目点がずれない。
   * 枠を覆わせる／覆わせないのどちらでも使う
   */
  get anchorOrigin(): string { return `${this.x}% ${this.y}%`; }

  /** 枠を覆わせない枠（キャラクターシートのメイン画像）向け。倍率だけを反映する */
  get zoomTransform(): string { return this.scale === DEFAULT_SCALE ? 'none' : `scale(${this.scale})`; }

  /**
   * 枠を覆わせる枠向けの配置。left/top は枠基準、translate は画像自身の大きさ基準で解決されるため、
   * cover 後のピクセル値を知らなくても「画像の (x%, y%) を枠の (x%, y%) に置く」が表せる。
   */
  get coverLeft(): string { return `${this.x}%`; }
  get coverTop(): string { return `${this.y}%`; }
  get coverTransform(): string {
    let translate = `translate(${-this.x}%, ${-this.y}%)`;
    return this.scale === DEFAULT_SCALE ? translate : `${translate} scale(${this.scale})`;
  }

  /** 枠を覆うために 100% を指定する軸。もう片方は auto にして縦横比を保たせる。 */
  static coverAxis(naturalWidth: number, naturalHeight: number, frameWidth: number, frameHeight: number): CoverAxis | null {
    if (!(0 < naturalWidth) || !(0 < naturalHeight)) return null;
    if (!(0 < frameWidth) || !(0 < frameHeight)) return null;
    return naturalWidth * frameHeight > naturalHeight * frameWidth ? 'height' : 'width';
  }

  /** 既定値なら空文字。属性を書かずに済ませるため */
  toString(): string {
    return this.isDefault ? '' : `${this.x} ${this.y} ${this.scale}`;
  }

  withX(x: number): ImageCrop {
    return ImageCrop.of(x, this.y, this.scale);
  }

  withY(y: number): ImageCrop {
    return ImageCrop.of(this.x, y, this.scale);
  }

  withScale(scale: number): ImageCrop {
    return ImageCrop.of(this.x, this.y, scale);
  }

  /**
   * 枠 frameWidth x frameHeight の中で dx, dy px ドラッグした結果を返す。
   * naturalWidth / naturalHeight は画像の元サイズで、cover 後の表示サイズはここで求める。
   */
  pan(dx: number, dy: number, frameWidth: number, frameHeight: number, naturalWidth: number, naturalHeight: number): ImageCrop {
    let cover = coverSize(frameWidth, frameHeight, naturalWidth, naturalHeight);
    return ImageCrop.of(
      panAxis(this.x, dx, frameWidth, cover.width * this.scale),
      panAxis(this.y, dy, frameHeight, cover.height * this.scale),
      this.scale);
  }

  static parse(text: string): ImageCrop {
    if (text == null) return ImageCrop.default;
    // filter が前後の空要素を落とすので、事前の trim は要らない
    let parts = text.split(/[\s,]+/).filter(part => 0 < part.length);
    if (parts.length < 3) return ImageCrop.default;
    return ImageCrop.of(Number(parts[0]), Number(parts[1]), Number(parts[2]));
  }

  static from(element: DataElement): ImageCrop {
    return ImageCrop.parse(ImageCrop.sourceOf(element));
  }

  /** キャッシュの新旧判定に使う、属性の生値 */
  static sourceOf(element: DataElement): string {
    return element ? element.getAttribute(ATTRIBUTE_NAME) : '';
  }

  static write(element: DataElement, crop: ImageCrop) {
    if (!element) return;
    let text = crop ? crop.toString() : '';
    // 値が変わらないときに update() を呼ぶと、無意味な同期が飛ぶ
    if (element.getAttribute(ATTRIBUTE_NAME) === text) return;
    if (0 < text.length) {
      element.setAttribute(ATTRIBUTE_NAME, text);
    } else {
      element.removeAttribute(ATTRIBUTE_NAME);
    }
  }

  private static of(x: number, y: number, scale: number): ImageCrop {
    let crop = new ImageCrop(x, y, scale);
    return crop.isDefault ? ImageCrop.default : crop;
  }
}

/** 枠を cover で埋めたときの画像の表示サイズ */
function coverSize(frameWidth: number, frameHeight: number, naturalWidth: number, naturalHeight: number): { width: number, height: number } {
  let axis = ImageCrop.coverAxis(naturalWidth, naturalHeight, frameWidth, frameHeight);
  // 軸が決まらない（画像か枠の寸法が不明）うちは、枠ぴったりの画像として扱う
  if (axis == null) return { width: frameWidth, height: frameHeight };
  // 合わせた軸が枠ちょうどになり、もう片方が縦横比のぶんだけはみ出す
  return axis === 'width'
    ? { width: frameWidth, height: naturalHeight * (frameWidth / naturalWidth) }
    : { width: naturalWidth * (frameHeight / naturalHeight), height: frameHeight };
}

/**
 * 1 軸ぶんのドラッグ。X'(u) = x*F + k*Wc*(u - x) を x で微分すると F - k*Wc になることから、
 * 見た目を delta px 動かすのに必要な注目点の移動量は -delta / (k*Wc - F) になる。
 */
function panAxis(percent: number, delta: number, frame: number, image: number): number {
  let overflow = image - frame;
  // はみ出しが無ければ動かす余地も無い
  if (!Number.isFinite(overflow) || overflow <= 0) return percent;
  return percent - delta / overflow * 100;
}

function clampPercent(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return round(MathUtil.clamp(value, 0, 100), 1);
}

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SCALE;
  return round(MathUtil.clamp(value, ImageCrop.minScale, ImageCrop.maxScale), 2);
}

/** 属性文字列を短く保ち、既定値との一致判定を浮動小数の誤差から守る */
function round(value: number, digits: number): number {
  let factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
