import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ImageCrop } from '@udonarium/image-crop';
import { InputHandler } from 'directive/input-handler';
import { ModalService } from 'service/modal.service';

export interface ImageCropSettingOption {
  imageUrl: string;
  crop?: ImageCrop;
  /** タイトルに出す画像の呼び名 */
  name?: string;
}

/**
 * 画像の表示調整（注目点・拡大率）を決めるモーダル。
 *
 * 編集中はローカルに閉じ、OK を押したときだけ呼び出し側が DataElement へ書く。
 * ドラッグのたびに同期させると、他のピアに毎フレーム更新が飛んでしまうため。
 */
@Component({
  selector: 'image-crop-setting',
  templateUrl: './image-crop-setting.component.html',
  styleUrls: ['./image-crop-setting.component.css']
})
export class ImageCropSettingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('frame', { static: true }) frameElementRef: ElementRef<HTMLElement>;
  @ViewChild('image', { static: true }) imageElementRef: ElementRef<HTMLImageElement>;

  imageUrl: string = '';
  crop: ImageCrop = ImageCrop.default;

  get minScale(): number { return ImageCrop.minScale; }
  get maxScale(): number { return ImageCrop.maxScale; }
  get isDefault(): boolean { return this.crop.isDefault; }

  private name: string = '';
  private input: InputHandler = null;
  private lastX: number = 0;
  private lastY: number = 0;

  constructor(
    private modalService: ModalService
  ) {
    let option: ImageCropSettingOption = this.modalService.option;
    if (option) {
      this.imageUrl = option.imageUrl ?? '';
      this.crop = option.crop ?? ImageCrop.default;
      this.name = option.name ?? '';
    }
  }

  ngOnInit() {
    Promise.resolve().then(() => this.modalService.title = 0 < this.name.length ? `画像の表示調整（${this.name}）` : '画像の表示調整');
  }

  ngAfterViewInit() {
    this.input = new InputHandler(this.frameElementRef.nativeElement);
    this.input.onStart = () => {
      this.lastX = this.input.pointer.x;
      this.lastY = this.input.pointer.y;
    };
    this.input.onMove = event => {
      // タッチでのスクロールと、マウスでの画像ドラッグを抑える
      event.preventDefault();
      let x = this.input.pointer.x;
      let y = this.input.pointer.y;
      this.pan(x - this.lastX, y - this.lastY);
      this.lastX = x;
      this.lastY = y;
    };
  }

  ngOnDestroy() {
    if (this.input) this.input.destroy();
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    let delta = event.deltaY;
    // Firefox は行単位で通知してくるので、おおよその行高を掛けて px に直す
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    // ホイール 1 ノッチ（おおよそ 100px）で 0.1 倍
    this.crop = this.crop.withScale(this.crop.scale - delta / 1000);
  }

  onXInput(event: Event) {
    this.crop = this.crop.withX(Number((event.target as HTMLInputElement).value));
  }

  onYInput(event: Event) {
    this.crop = this.crop.withY(Number((event.target as HTMLInputElement).value));
  }

  onScaleInput(event: Event) {
    this.crop = this.crop.withScale(Number((event.target as HTMLInputElement).value));
  }

  reset() { this.crop = ImageCrop.default; }
  submit() { this.modalService.resolve(this.crop); }
  cancel() { this.modalService.resolve(null); }

  /**
   * 枠と画像の実サイズは CSS 側で決まるので、値を持ち回らず都度 DOM から読む。
   * 読み込みが終わるまで naturalWidth は 0 だが、ImageCrop.pan() は枠ぴったりの画像として扱うので、
   * 拡大中ならその間も動かせる。等倍のときだけ、はみ出しが無いものとして動かない。
   */
  private pan(dx: number, dy: number) {
    let frame = this.frameElementRef.nativeElement;
    let image = this.imageElementRef.nativeElement;
    this.crop = this.crop.pan(dx, dy, frame.clientWidth, frame.clientHeight, image.naturalWidth, image.naturalHeight);
  }
}
