import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { ChatPalette } from '@udonarium/chat-palette';
import { getCharacter } from 'component/game-character-dashboard/character-tags';
import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';
import { DoublePressDetector } from '@udonarium/double-press';
import { openPaletteIndexMenu } from 'component/chat-palette/palette-index';
import { getPaletteTopLine, scrollPaletteToLine } from 'component/chat-palette/palette-scroll';
import { ContextMenuService } from 'service/context-menu.service';
import { PointerDeviceService } from 'service/pointer-device.service';

/** ダッシュボード用のチャットパレット。 */
@Component({
  selector: 'editor-for-palette',
  templateUrl: './editor-for-palette.component.html',
  styleUrls: ['../dashboard-shared.css', './editor-for-palette.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorForPaletteComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('chatPalette') private selectElementRef: ElementRef<HTMLSelectElement>;
  @ViewChild('paletteTextArea') private textAreaElementRef: ElementRef<HTMLTextAreaElement>;

  @Input() selectedIdentifier: string = '';
  @Output() paletteSelect = new EventEmitter<string>();
  @Output() paletteSubmit = new EventEmitter<void>();

  isEdit: boolean = false;
  editPalette: string = '';

  private doublePress = new DoublePressDetector();
  /** 編集開始時のパレット。編集中にコマが切り替わっても確定先を動かさないため */
  private editingPalette: ChatPalette = null;

  get character(): GameCharacter | null { return getCharacter(this.selectedIdentifier); }

  get palette(): ChatPalette | null {
    let character = this.character;
    return character ? character.chatPalette : null;
  }

  get paletteLines(): string[] {
    let palette = this.palette;
    return palette ? palette.getPalette() : [];
  }

  /** いま表示されているパレット本体。閲覧時は select、編集時は textarea */
  private get paletteElement(): HTMLSelectElement | HTMLTextAreaElement | null {
    let elementRef = this.isEdit ? this.textAreaElementRef : this.selectElementRef;
    return elementRef ? elementRef.nativeElement : null;
  }

  /** 索引のもとになる行。編集中はまだ確定していない編集内容を見る */
  private get indexSourceLines(): string[] {
    return this.isEdit ? this.editPalette.split('\n') : this.paletteLines;
  }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private contextMenuService: ContextMenuService,
    private pointerDeviceService: PointerDeviceService,
  ) {}

  ngOnInit() {
    EventSystem.register(this)
      // 他パネル・他ピアでの編集を拾う
      .on(`UPDATE_GAME_OBJECT/aliasName/${ChatPalette.aliasName}`, event => {
        this.changeDetector.markForCheck();
      })
      .on('DELETE_GAME_OBJECT', event => {
        this.changeDetector.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedIdentifier'] && !changes['selectedIdentifier'].isFirstChange()) {
      // コマが変わったら編集は元のパレットに確定して抜ける。
      // 別のパレットを表示することになるのでスクロール位置は引き継がない
      this.setEditMode(false);
      // 前のコマで張った二度押しの構えは持ち越さない
      this.doublePress.cancel();
    }
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    this.doublePress.cancel();
    // タブ切り替えやパネルを閉じたときも編集内容は捨てない
    this.setEditMode(false);
  }

  selectPalette(line: string) {
    this.paletteSelect.emit(line);
  }

  /** 単クリックで入力欄へ、ダブルクリックで送信。判定は行の内容でなく位置で行う */
  clickPalette(line: string, index: number) {
    if (this.doublePress.press(index)) {
      this.paletteSubmit.emit();
      return;
    }
    this.selectPalette(line);
  }

  /** 索引一覧を開く。選んだ見出しが先頭に来るようスクロールさせる */
  openIndexMenu(event: MouseEvent) {
    event.stopPropagation();

    let deps = { contextMenuService: this.contextMenuService, pointerDeviceService: this.pointerDeviceService };
    openPaletteIndexMenu(deps, this.indexSourceLines, line => {
      // select の selectedIndex は動かさない。見出し行が入力欄に入ってしまう
      scrollPaletteToLine(this.paletteElement, line);
    });
  }

  toggleEditMode() {
    // select と textarea は *ngIf で入れ替わるので、先頭行を控えて差し替え先へ引き継ぐ
    let topLine = getPaletteTopLine(this.paletteElement);
    this.setEditMode(!this.isEdit);
    // 変更検知が走って差し替えが終わるまで復元先の要素は存在しない
    setTimeout(() => scrollPaletteToLine(this.paletteElement, topLine));
  }

  /** 編集モードの出入り。スクロール位置の引き継ぎはしない */
  private setEditMode(isEdit: boolean) {
    if (isEdit === this.isEdit) return;
    if (isEdit) {
      if (!this.palette) return;
      this.editingPalette = this.palette;
      this.editPalette = this.editingPalette.value + '';
      this.isEdit = true;
    } else {
      this.editingPalette.setPalette(this.editPalette);
      this.editingPalette = null;
      this.isEdit = false;
    }
  }
}
