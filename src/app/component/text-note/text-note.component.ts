import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { EventSystem } from '@udonarium/core/system';
import { MathUtil } from '@udonarium/core/system/util/math-util';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { TextNote } from '@udonarium/text-note';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { TabletopObjectSettingComponent } from 'component/tabletop-object-setting/tabletop-object-setting.component';
import { MovableOption } from 'directive/movable.directive';
import { RotableOption } from 'directive/rotable.directive';
import { ContextMenuAction, ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { SelectionState, TabletopSelectionService } from 'service/tabletop-selection.service';

@Component({
  selector: 'text-note',
  templateUrl: './text-note.component.html',
  styleUrls: ['./text-note.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextNoteComponent implements OnChanges, OnDestroy {
  @ViewChild('textArea', { static: true }) textAreaElementRef: ElementRef;

  @Input() textNote: TextNote = null;
  @Input() is3D: boolean = false;

  get title(): string { return this.textNote.title; }
  get text(): string { this.calcFitHeightIfNeeded(); return this.textNote.text; }
  set text(text: string) { this.calcFitHeightIfNeeded(); this.textNote.text = text; }
  get fontSize(): number { this.calcFitHeightIfNeeded(); return this.textNote.fontSize; }
  get imageFile(): ImageFile { return this.textNote.imageFile; }
  get rotate(): number { return this.textNote.rotate; }
  set rotate(rotate: number) { this.textNote.rotate = rotate; }
  get height(): number { return MathUtil.clampMin(this.textNote.height); }
  get width(): number { return MathUtil.clampMin(this.textNote.width); }

  get isLock(): boolean { return this.textNote.isLock; }
  set isLock(isLock: boolean) { this.textNote.isLock = isLock; }
  get isUpright(): boolean { return this.textNote.isUpright; }
  set isUpright(isUpright: boolean) { this.textNote.isUpright = isUpright; }
  get limitHeight(): boolean { return this.textNote.limitHeight; }

  get isActive(): boolean { return document.activeElement === this.textAreaElementRef.nativeElement; }

  get selectionState(): SelectionState { return this.selectionService.state(this.textNote); }
  get isSelected(): boolean { return this.selectionState !== SelectionState.NONE; }
  get isMagnetic(): boolean { return this.selectionState === SelectionState.MAGNETIC; }

  private callbackOnMouseUp = (e) => this.onMouseUp(e);

  gridSize: number = 50;

  private calcFitHeightTimer: NodeJS.Timeout = null;

  movableOption: MovableOption = {};
  rotableOption: RotableOption = {};

  constructor(
    private ngZone: NgZone,
    private contextMenuService: ContextMenuService,
    private panelService: PanelService,
    private changeDetector: ChangeDetectorRef,
    private selectionService: TabletopSelectionService,
    private pointerDeviceService: PointerDeviceService
  ) { }

  ngOnChanges(): void {
    EventSystem.unregister(this);
    EventSystem.register(this)
      .on(`UPDATE_GAME_OBJECT/identifier/${this.textNote?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on(`UPDATE_OBJECT_CHILDREN/identifier/${this.textNote?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on('SYNCHRONIZE_FILE_LIST', event => {
        this.changeDetector.markForCheck();
      })
      .on('UPDATE_FILE_RESOURE', event => {
        this.changeDetector.markForCheck();
      })
      .on(`UPDATE_SELECTION/identifier/${this.textNote?.identifier}`, event => {
        this.changeDetector.markForCheck();
      });
    this.movableOption = {
      tabletopObject: this.textNote,
      transformCssOffset: 'translateZ(0.15px)',
      colideLayers: ['terrain']
    };
    this.rotableOption = {
      tabletopObject: this.textNote
    };
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  @HostListener('dragstart', ['$event'])
  onDragstart(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: any) {
    if (this.isActive) return;
    e.preventDefault();
    this.textNote.toTopmost();

    // TODO:もっと良い方法考える
    if (e.button === 2 || this.isLock) {
      EventSystem.trigger('DRAG_LOCKED_OBJECT', { srcEvent: e });
      if (e.button === 2) return;
    }

    this.addMouseEventListeners();
  }

  onMouseUp(e: any) {
    if (this.pointerDeviceService.isAllowedToOpenContextMenu) {
      let selection = window.getSelection();
      if (!selection.isCollapsed) selection.removeAllRanges();
      this.textAreaElementRef.nativeElement.focus();
    }
    this.removeMouseEventListeners();
    e.preventDefault();
  }

  onRotateMouseDown(e: any) {
    e.stopPropagation();
    e.preventDefault();
  }

  /**
   * 高さ制限中のスクロールバー操作はブラウザ標準の挙動に任せる。
   * 伝搬を止め、テーブルドラッグを上書きする。
   */
  onTextAreaMouseDown(e: MouseEvent) {
    let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    let scrollBarWidth = textArea.offsetWidth - textArea.clientWidth;
    if (scrollBarWidth <= 0 || e.offsetX < textArea.clientWidth) return;
    e.stopPropagation();
    textArea.focus();
    this.changeDetector.markForCheck();
  }

  /**
   * 3D変換されたツリーの中にあるためブラウザ標準のホイールスクロールが働かないので、自前でスクロールさせる。
   */
  onTextAreaWheel(e: WheelEvent) {
    let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    let sensitivity: number = 0.1;
    if (!this.limitHeight || textArea.scrollHeight <= textArea.clientHeight) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();

    let deltaY = e.deltaY;
    switch (e.deltaMode) {
      case WheelEvent.DOM_DELTA_LINE:
        deltaY *= 16;
        break;
      case WheelEvent.DOM_DELTA_PAGE:
        deltaY *= textArea.clientHeight;
        break;
    }
    textArea.scrollTop += deltaY * sensitivity;
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: Event) {
    this.removeMouseEventListeners();
    if (this.isActive) return;
    e.stopPropagation();
    e.preventDefault();

    if (!this.pointerDeviceService.isAllowedToOpenContextMenu) return;
    let position = this.pointerDeviceService.pointers[0];

    let menuActions: ContextMenuAction[] = [];
    menuActions = menuActions.concat(this.makeSelectionContextMenu());
    menuActions = menuActions.concat(this.makeContextMenu());

    this.contextMenuService.open(position, menuActions, this.title);
  }

  onMove() {
    this.contextMenuService.close();
    SoundEffect.play(PresetSound.cardPick);
  }

  onMoved() {
    SoundEffect.play(PresetSound.cardPut);
  }

  private makeSelectionContextMenu(): ContextMenuAction[] {
    if (this.selectionService.objects.length < 1) return [];

    let actions: ContextMenuAction[] = [];

    let objectPosition = { x: this.textNote.location.x, y: this.textNote.location.y, z: this.textNote.posZ };
    actions.push({ name: 'ここに集める', action: () => this.selectionService.congregate(objectPosition) });
    actions.push(ContextMenuSeparator);

    return actions;
  }

  private makeContextMenu(): ContextMenuAction[] {
    let actions: ContextMenuAction[] = [];

    actions.push((this.isLock
      ? {
        name: '固定解除', action: () => {
          this.isLock = false;
          SoundEffect.play(PresetSound.unlock);
        }
      }
      : {
        name: '固定する', action: () => {
          this.isLock = true;
          SoundEffect.play(PresetSound.lock);
        }
      }
    ));
    actions.push(ContextMenuSeparator);
    actions.push((this.isUpright
      ? {
        name: '寝かせる', action: () => {
          this.isUpright = false;
          SoundEffect.play(PresetSound.sweep);
        }
      }
      : {
        name: '直立させる', action: () => {
          this.isUpright = true;
          SoundEffect.play(PresetSound.sweep);
        }
      }
    ));
    actions.push(ContextMenuSeparator);
    actions.push({ name: 'メモを編集', action: () => { this.showDetail(this.textNote); } });
    actions.push({
      name: 'コピーを作る', action: () => {
        let cloneObject = this.textNote.clone();
        cloneObject.location.x += this.gridSize;
        cloneObject.location.y += this.gridSize;
        cloneObject.isLock = false;
        cloneObject.toTopmost();
        SoundEffect.play(PresetSound.cardPut);
      }
    });
    actions.push({
      name: '削除する', action: () => {
        this.textNote.destroy();
        SoundEffect.play(PresetSound.sweep);
      }
    });
    actions.push(ContextMenuSeparator);
    actions.push({ name: '設定', action: () => TabletopObjectSettingComponent.open(this.panelService, this.textNote, this.pointerDeviceService.pointers[0]) });

    return actions;
  }

  calcFitHeightIfNeeded() {
    if (this.calcFitHeightTimer) return;
    this.ngZone.runOutsideAngular(() => {
      this.calcFitHeightTimer = setTimeout(() => {
        this.calcFitHeight();
        this.calcFitHeightTimer = null;
      }, 0);
    });
  }

  calcFitHeight() {
    let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    textArea.style.height = '0';
    if (!this.limitHeight) {
      if (textArea.scrollHeight > textArea.offsetHeight) {
        textArea.style.height = textArea.scrollHeight + 'px';
      }
      return;
    }
    // height設定値までに抑える（タイトル行がある場合はその分(30px)を差し引く）
    let maxHeight = MathUtil.clampMin(this.height * this.gridSize, this.gridSize) - (this.title.length ? 32 : 2);
    textArea.style.height = MathUtil.clampMax(textArea.scrollHeight, maxHeight) + 'px';
  }

  private addMouseEventListeners() {
    document.body.addEventListener('mouseup', this.callbackOnMouseUp, false);
  }

  private removeMouseEventListeners() {
    document.body.removeEventListener('mouseup', this.callbackOnMouseUp, false);
  }

  private showDetail(gameObject: TextNote) {
    EventSystem.trigger('SELECT_TABLETOP_OBJECT', { identifier: gameObject.identifier, className: gameObject.aliasName });
    let coordinate = this.pointerDeviceService.pointers[0];
    let title = '共有メモ設定';
    if (gameObject.title.length) title += ' - ' + gameObject.title;
    let option: PanelOption = { title: title, left: coordinate.x - 350, top: coordinate.y - 200, width: 700, height: 400 };
    let component = this.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, option);
    component.tabletopObject = gameObject;
  }

}
