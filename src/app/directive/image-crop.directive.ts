import { AfterViewInit, booleanAttribute, ChangeDetectorRef, Directive, ElementRef, HostBinding, HostListener, Input, NgZone, OnChanges, OnDestroy } from '@angular/core';
import { CoverAxis, ImageCrop } from '@udonarium/image-crop';

/**
 * 画像の表示調整（注目点・拡大率）を CSS に落とす。
 *
 * `imageCropCovers` を付けると、枠を覆うサイズと位置をここが全部入れる。**object-fit は使わない** —
 * Chromium の GPU ラスタライズ経路は、画像の一部だけを描く object-fit の経路でミップマップを切るため、
 * 大きく縮小するとローパスが足りずアリアスが出る（HWA オンの Chrome / Edge で再現、Firefox は無事）。
 * 画像自身を枠を覆うサイズにして親に切らせると、画像全体を描く経路に乗るのでアンチエイリアスが効く。
 *
 * 付けた場合、枠側（img の親）には `position: relative` と `overflow: hidden` が要る。
 * さらに、**枠は実寸を測られるので、中身や兄弟に応じて伸びる箱を枠にしてはいけない** —
 * table-cell（行の高さまで伸び、max-height も効かない）や、stretch する flex / grid アイテムがそれ。
 * 該当する場所では、内側に固定サイズの div を 1 枚挟んでそれを枠にする
 * （chat-input / game-object-inventory の `.image-frame` がこの形）。
 *
 * 付けない場合は倍率だけを反映する（キャラクターシートのメイン画像のように、切り抜かない枠向け）。
 */
@Directive({
  selector: 'img[imageCrop]'
})
export class ImageCropDirective implements OnChanges, AfterViewInit, OnDestroy {
  @Input() imageCrop: ImageCrop;
  @Input({ transform: booleanAttribute }) imageCropCovers: boolean = false;

  /** 枠を覆うために 100% を指定する軸。画像か枠の寸法が分からないうちは null */
  private coverAxis: CoverAxis | null = null;
  /** 前回の imageCropCovers。軸に効く入力はこれだけなので、変わったときだけ測り直す。null はまだ見ていないこと */
  private wasCovering: boolean | null = null;
  private frameObserver: ResizeObserver = null;

  private get crop(): ImageCrop { return this.imageCrop ?? ImageCrop.default; }
  private get isCovering(): boolean { return this.imageCropCovers && this.coverAxis != null; }

  constructor(
    private elementRef: ElementRef<HTMLImageElement>,
    private changeDetector: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  /**
   * imageCropCovers が後から立つ枠（オーバービューパネル）でも軸を測り直す。
   * imageCrop の値は軸に効かないので、変わっても測らない（モーダルのドラッグ中に毎回測ることになるため）。
   */
  ngOnChanges() {
    if (this.wasCovering === this.imageCropCovers) return;
    this.wasCovering = this.imageCropCovers;
    this.refresh();
  }

  ngAfterViewInit() {
    let frame = this.elementRef.nativeElement.parentElement;
    if (!frame) return;
    /*
     * 枠が畳まれた状態（モーダルが開く前など）で初期化されると寸法が 0 で測れず、
     * あとから表示されても誰も測り直してくれない。枠の寸法変化を追って測り直す。
     * 読み込み済みの画像では load が飛ばないので、初回もこの経路で拾う。
     */
    this.ngZone.runOutsideAngular(() => {
      // 軸が変わらないなら zone に入らない。入るとアプリ全体の変更検知が回ってしまう
      this.frameObserver = new ResizeObserver(() => {
        if (this.measureCoverAxis() === this.coverAxis) return;
        this.ngZone.run(() => this.refresh());
      });
      this.frameObserver.observe(frame);
    });
  }

  ngOnDestroy() {
    if (this.frameObserver) this.frameObserver.disconnect();
  }

  @HostListener('load')
  onLoad() { this.refresh(); }

  @HostBinding('style.position') get position(): string { return this.isCovering ? 'absolute' : null; }
  @HostBinding('style.width') get width(): string { return this.isCovering ? (this.coverAxis === 'width' ? '100%' : 'auto') : null; }
  @HostBinding('style.height') get height(): string { return this.isCovering ? (this.coverAxis === 'height' ? '100%' : 'auto') : null; }
  @HostBinding('style.left') get left(): string { return this.isCovering ? this.crop.coverLeft : null; }
  @HostBinding('style.top') get top(): string { return this.isCovering ? this.crop.coverTop : null; }
  @HostBinding('style.transform') get transform(): string { return this.isCovering ? this.crop.coverTransform : this.crop.zoomTransform; }
  /**
   * 注目点と同じ点を回転中心に据えることで、拡大が常に注目点を中心に掛かる。
   * 既定の 50% 50% のままだと倍率を上げた時点で注目点がずれる。
   */
  @HostBinding('style.transform-origin') get transformOrigin(): string { return this.crop.anchorOrigin; }

  private refresh() {
    let axis = this.measureCoverAxis();
    if (this.coverAxis === axis) return;
    this.coverAxis = axis;
    this.changeDetector.markForCheck();
  }

  /** 枠と画像の実寸を DOM から測って軸を決める。判定そのものは ImageCrop.coverAxis が持つ */
  private measureCoverAxis(): CoverAxis | null {
    if (!this.imageCropCovers) return null;
    let image = this.elementRef.nativeElement;
    let frame = image.parentElement;
    if (!frame) return null;
    return ImageCrop.coverAxis(image.naturalWidth, image.naturalHeight, frame.clientWidth, frame.clientHeight);
  }
}
