import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { ImageCrop } from '@udonarium/image-crop';

import { FileSelecterComponent } from 'component/file-selecter/file-selecter.component';
import { ImageCropSettingComponent, ImageCropSettingOption } from 'component/image-crop-setting/image-crop-setting.component';
import { ContextMenuAction } from 'service/context-menu.service';
import { ImageService } from 'service/image.service';
import { ModalService } from 'service/modal.service';

@Component({
  selector: 'character-image-list',
  templateUrl: './character-image-list.component.html',
  styleUrls: ['./character-image-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CharacterImageListComponent implements OnChanges, OnDestroy {
  @Input() gameCharacter: GameCharacter = null;

  @ViewChild('imageList') imageListElementRef: ElementRef<HTMLElement>;

  /**
   * コマの右クリックと chat-input のどちらからも同じ切り替えメニューを出すためのビルダー。
   * 名前はユーザーが任意で付けるものなので、未設定なら 1 起点の番号を代わりに表示する。
   */
  static makeContextMenuActions(gameCharacter: GameCharacter, imageService: ImageService): ContextMenuAction[] {
    let selectedIndex = gameCharacter.imageIndex;
    return gameCharacter.imageElements.map((element, index) => ({
      name: `${index === selectedIndex ? '☑' : '☐'} ${GameCharacter.getImageName(element) || index + 1}`,
      thumbnailUrl: CharacterImageListComponent.imageUrlOf(element, imageService),
      thumbnailCrop: ImageCrop.from(element),
      action: () => { gameCharacter.imageIndex = index; }
    }));
  }

  /** 画像が未設定なら既定のキャラクター画像にフォールバックする */
  private static imageUrlOf(element: DataElement, imageService: ImageService): string {
    return imageService.getDefaultCharacterOr(<string>(element ? element.value : '')).url;
  }

  /** 入力中の表示名。書き戻しをデバウンスする間だけ値を保持する */
  private nameCache: Map<string, string> = new Map();
  /** 画像ごとの表示調整。identifier -> 属性の生値とそこから作った値 */
  private cropCache: Map<string, { source: string, crop: ImageCrop }> = new Map();
  private updateTimer: NodeJS.Timeout = null;

  constructor(
    private changeDetector: ChangeDetectorRef,
    private imageService: ImageService,
    private modalService: ModalService
  ) { }

  ngOnChanges(): void {
    EventSystem.unregister(this);
    EventSystem.register(this)
      // 画像の追加・削除・差し替えは配下の DataElement の更新として飛んでくる
      .on('UPDATE_GAME_OBJECT', event => {
        if (!this.gameCharacter) return;
        let object = ObjectStore.instance.get(event.data.identifier);
        if (this.gameCharacter === object || (object instanceof ObjectNode && this.gameCharacter.contains(object))) {
          this.changeDetector.markForCheck();
        }
      })
      .on('DELETE_GAME_OBJECT', event => {
        this.changeDetector.markForCheck();
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    clearTimeout(this.updateTimer);
  }

  get imageElements(): DataElement[] { return this.gameCharacter ? this.gameCharacter.imageElements : []; }
  get imageCount(): number { return this.imageElements.length; }

  /** ngFor が入力欄を作り直してフォーカスを奪わないように identifier で追跡する */
  trackByElement(index: number, element: DataElement): string { return element.identifier; }

  imageUrl(element: DataElement): string {
    return CharacterImageListComponent.imageUrlOf(element, this.imageService);
  }

  /**
   * テンプレートから変更検知のたびに呼ばれるので、属性の生値が変わったときだけ作り直す。
   * TabletopObject.imageCrop と同じ形。
   */
  crop(element: DataElement): ImageCrop {
    if (!element) return ImageCrop.default;
    let source = ImageCrop.sourceOf(element);
    let cached = this.cropCache.get(element.identifier);
    if (!cached || cached.source !== source) {
      cached = { source: source, crop: ImageCrop.parse(source) };
      this.cropCache.set(element.identifier, cached);
    }
    return cached.crop;
  }

  isSelected(index: number): boolean { return this.gameCharacter.imageIndex === index; }

  /**
   * シート全体の縦スクロールを奪って、ホイールだけで一覧を横スクロールさせる。
   * 端に着いても縦スクロールには渡さない。意図しない縦移動で見失うほうが困るため。
   */
  onWheel(event: WheelEvent) {
    let element = this.imageListElementRef?.nativeElement;
    if (!element) return;
    // そもそもスクロールの余地がないときだけ、シート側の縦スクロールに通す
    if (element.scrollWidth <= element.clientWidth) return;

    let delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
    // Firefox は行単位で通知してくるので、おおよその行高を掛けて px に直す
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;

    event.preventDefault();
    element.scrollLeft += delta;
  }

  select(index: number) { this.gameCharacter.imageIndex = index; }

  getName(element: DataElement): string {
    if (!element) return '';
    let cached = this.nameCache.get(element.identifier);
    return cached != null ? cached : GameCharacter.getImageName(element);
  }

  setName(element: DataElement, name: string) {
    if (!element) return;
    this.nameCache.set(element.identifier, name);
    this.setUpdateTimer();
  }

  addImage() {
    this.gameCharacter.addImageElement();
    // 追加した画像は末尾に付くので、そこまでスクロールして見せる。
    // scrollWidth が増えてからでないと動かないため、先に描画を確定させる
    this.changeDetector.detectChanges();
    let element = this.imageListElementRef?.nativeElement;
    if (element) element.scrollLeft = element.scrollWidth;
  }

  removeImage(index: number) {
    this.gameCharacter.removeImageElement(index);
  }

  moveImage(index: number, offset: number) {
    this.gameCharacter.moveImageElement(index, offset);
  }

  changeImage(index: number) {
    this.modalService.open<string>(FileSelecterComponent, { isAllowedEmpty: true }).then(value => {
      let element = this.imageElements[index];
      if (!element || value == null) return;
      element.value = value;
    });
  }

  adjustImage(index: number) {
    let element = this.imageElements[index];
    if (!element) return;
    let option: ImageCropSettingOption = {
      imageUrl: this.imageUrl(element),
      crop: this.crop(element),
      name: GameCharacter.getImageName(element) || `${index + 1}`
    };
    this.modalService.open<ImageCrop>(ImageCropSettingComponent, option).then(value => {
      // モーダルを開いている間に他のピアが画像を消しているかもしれないので、取り直す
      let element = this.imageElements[index];
      if (!element || value == null) return;
      ImageCrop.write(element, value);
    });
  }

  private setUpdateTimer() {
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      let elements = this.imageElements;
      this.nameCache.forEach((name, identifier) => {
        let element = elements.find(element => element.identifier === identifier);
        if (element && GameCharacter.getImageName(element) !== name) GameCharacter.setImageName(element, name);
      });
      this.nameCache.clear();
      this.updateTimer = null;
    }, 66);
  }
}
