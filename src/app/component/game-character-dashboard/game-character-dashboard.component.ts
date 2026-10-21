import { Component, ElementRef, NgZone, OnInit, OnDestroy, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Buff } from '@udonarium/buff';
import { CharacterPart } from '@udonarium/character-part/character-part';
import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { ChatInputHistory, WritingNotifier } from '@udonarium/chat-input';
import { ChatTab } from '@udonarium/chat-tab';
import { DataElement } from '@udonarium/data-element';
import { DiceBot } from '@udonarium/dice-bot';
import { EventSystem } from '@udonarium/core/system';
import { MathUtil } from '@udonarium/core/system/util/math-util';
import { GameCharacter } from '@udonarium/game-character';
import { ImageCrop } from '@udonarium/image-crop';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { PeerCursor } from '@udonarium/peer-cursor';
import { ResourceCommand } from '@udonarium/resource-command';
import { CharacterImageListComponent } from 'component/character-image-list/character-image-list.component';
import { openDicebotHelp } from 'component/chat-input/dicebot-help';
import { sendPaletteMessages } from 'component/chat-palette/palette-message';
import { getCharacter, getUnitBuffs, getUnitDataTags, resolveSelection } from 'component/game-character-dashboard/character-tags';
import { InputHandler } from 'directive/input-handler';
import { ChatMessageService } from 'service/chat-message.service';
import { ContextMenuService } from 'service/context-menu.service';
import { GameCharacterTargetingService } from 'service/game-character-targeting.service';
import { GameObjectInventoryService } from 'service/game-object-inventory.service';
import { ImageService } from 'service/image.service';
import { PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

type EditorName = 'resource' | 'buff' | 'palette';

/**
 * 一覧側に残す最小幅。CSS の `.chat-input-container { max-width: calc(100% - 160px) }` と対で維持する。
 */
const MIN_LIST_PANE_WIDTH = 160;

@Component({
  selector: 'game-character-dashboard',
  templateUrl: './game-character-dashboard.component.html',
  styleUrls: ['./dashboard-shared.css', './game-character-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameCharacterDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('textArea', { static: true }) textAreaElementRef: ElementRef;
  @ViewChild('paneSplitter', { static: true }) paneSplitterElementRef: ElementRef<HTMLElement>;
  @ViewChild('chatInputContainer', { static: true }) chatInputContainerElementRef: ElementRef<HTMLElement>;

  dashboardMode: 'column' | 'row' = 'column';
  listMode: 'column' | 'auto' | 'compact' = 'column';
  editorTab: EditorName = 'resource';
  /** row モードで畳んでいるエディタ。column モードでは editorTab が表示を決めるので参照しない */
  private collapsedEditors = new Set<EditorName>();

  text: string = '';

  get gameCharacters(): GameCharacter[] { return this.inventoryService.visibleTableCharacters; }

  /** 選択中の操作単位の identifier。単部位コマならコマ、多部位コマなら部位 */
  _selectedIdentifier: string = '';
  get selectedIdentifier(): string { return this._selectedIdentifier; }
  set selectedIdentifier(identifier: string) {
    this._selectedIdentifier = identifier;
    this.lastCharacterIdentifier = getCharacter(identifier)?.identifier ?? '';
    this.updateSelection();
  }
  /** 直近の選択のコマ（部位なら持ち主）。選んでいた部位が消えた後も、同じコマへ寄せられるように覚えておく */
  private lastCharacterIdentifier: string = '';

  // 選択中コマのぶんだけ導出してエディタへ渡す。
  private _resourceOptions: DataElement[] = [];
  get resourceOptions(): DataElement[] { return this._resourceOptions; }
  private _selectedBuffs: Buff[] = [];
  get selectedBuffs(): Buff[] { return this._selectedBuffs; }

  get gameType(): string { return !this.chatMessageService.gameType ? 'DiceBot' : this.chatMessageService.gameType; }
  set gameType(gameType: string) { this.chatMessageService.gameType = gameType; }

  private _chatTabidentifier: string = '';  // identifierのTypo? 他コンポに合わせる
  get chatTabidentifier(): string { return this._chatTabidentifier; }
  set chatTabidentifier(chatTabidentifier: string) { this._chatTabidentifier = chatTabidentifier; }

  get chatTab(): ChatTab { return ObjectStore.instance.get<ChatTab>(this.chatTabidentifier); }

  // ===== チャット入力 =====
  // 発言者は selectedIdentifier（＝一覧で選択中のコマ・部位）がそのまま務める
  sendTo: string = '';
  private writing = new WritingNotifier();
  private history = new ChatInputHistory();

  /** 一覧で選択中のコマ（部位なら持ち主）。選択が外れている・コマ以外を指しているなら null */
  get selectedCharacter(): GameCharacter | null { return getCharacter(this.selectedIdentifier); }
  get selectedUnit(): CharacterUnit | null { return CharacterUnit.resolve(this.selectedIdentifier); }

  /** チャット設定の発言者のプルダウンはコマ本体を並べる。選ぶと、そのコマの代表（多部位なら先頭の部位）を選ぶ */
  get selectedCharacterIdentifier(): string { return this.selectedCharacter?.identifier ?? ''; }
  set selectedCharacterIdentifier(identifier: string) {
    let character = getCharacter(identifier);
    this.selectedIdentifier = character ? CharacterUnit.primaryOf(character).identifier : '';
  }
  /** 選択中のコマの部位。単部位コマなら空 */
  get selectedParts(): CharacterPart[] { return this.selectedCharacter?.parts ?? []; }

  get imageFile(): ImageFile {
    let character = this.selectedCharacter;
    return character && character.imageFile ? character.imageFile : ImageFile.Empty;
  }
  get imageCrop(): ImageCrop {
    let character = this.selectedCharacter;
    return character ? character.imageCrop : ImageCrop.default;
  }

  /** 発言者に複数のコマ画像が登録されているときだけ、アイコンから切り替えられる */
  get imageSwitchableCharacter(): GameCharacter | null {
    let character = this.selectedCharacter;
    return character && 1 < character.imageCount ? character : null;
  }

  selectImage() {
    let gameCharacter = this.imageSwitchableCharacter;
    if (!gameCharacter) return;
    this.contextMenuService.open(
      this.pointerDeviceService.pointers[0],
      CharacterImageListComponent.makeContextMenuActions(gameCharacter, this.imageService),
      gameCharacter.name);
  }

  get diceBotInfos() { return DiceBot.infos; }
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get otherPeers(): PeerCursor[] { return ObjectStore.instance.getObjects(PeerCursor); }

  // ===== ペイン分割（row モード）=====
  private splitterInput: InputHandler = null;
  private splitterStartWidth: number = 0;
  /** ドラッグ開始時に CSS から読む可動域。TS 側に数値を写すと CSS とズレる */
  private splitterMinWidth: number = 0;
  private splitterMaxWidth: number = Number.POSITIVE_INFINITY;

  constructor(
    private panelService: PanelService,
    private changeDetector: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>,
    private ngZone: NgZone,
    private contextMenuService: ContextMenuService,
    private imageService: ImageService,
    private inventoryService: GameObjectInventoryService,
    private pointerDeviceService: PointerDeviceService,
    private targetingService: GameCharacterTargetingService,
    public chatMessageService: ChatMessageService,
  ) {}

  ngOnInit() {
    Promise.resolve().then(() => this.panelService.title = 'ダッシュボード');
    this._chatTabidentifier = 0 < this.chatMessageService.chatTabs.length ? this.chatMessageService.chatTabs[0].identifier : '';
    EventSystem.register(this)
      .on('UPDATE_INVENTORY', event => {
        this.validateSelectedIdentifier();
        this.updateSelection();
        this.changeDetector.markForCheck();
      })
      // 追加・編集・削除のいずれも UPDATE_INVENTORY には乗らないため、自分で購読する
      .on(`UPDATE_GAME_OBJECT/aliasName/${Buff.aliasName}`, event => {
        this.updateSelectedBuffs();
        this.changeDetector.markForCheck();
      })
      .on('DELETE_GAME_OBJECT', event => {
        this.validateSelectedIdentifier();
        this.updateSelection();
        this.changeDetector.markForCheck();
      })
      .on('MESSAGE_ADDED', event => {
        this.changeDetector.markForCheck();
      })
      .on('CONNECT_PEER', event => {
        this.changeDetector.markForCheck();
      })
      .on('DISCONNECT_PEER', event => {
        let object = ObjectStore.instance.get(this.sendTo);
        if (object instanceof PeerCursor && object.peerId === event.data.peerId) this.sendTo = '';
        this.changeDetector.markForCheck();
      });
  }

  ngAfterViewInit() {
    Promise.resolve().then(() => {
      this.validateSelectedIdentifier();
      this.updateSelection();
      this.changeDetector.markForCheck();
    });
    this.initPaneSplitter();
  }

  /** row モードのペイン境界のドラッグを受け付ける。 */
  private initPaneSplitter() {
    this.ngZone.runOutsideAngular(() => {
      this.splitterInput = new InputHandler(this.paneSplitterElementRef.nativeElement);
    });
    this.splitterInput.onStart = event => {
      event.stopPropagation();
      let container = this.chatInputContainerElementRef.nativeElement;
      this.splitterStartWidth = container.getBoundingClientRect().width;
      // max-width は calc() のまま返ってきて px へ解決されない
      this.splitterMinWidth = parseFloat(getComputedStyle(container).minWidth) || 0;
      this.splitterMaxWidth = this.elementRef.nativeElement.clientWidth
        - MIN_LIST_PANE_WIDTH - this.paneSplitterElementRef.nativeElement.offsetWidth;
    };
    this.splitterInput.onMove = event => {
      // タッチのスクロールとテキスト選択を抑える
      if (event.cancelable) event.preventDefault();
      this.setChatPaneWidth(this.splitterStartWidth + this.splitterInput.pointer.x - this.splitterInput.startPointer.x);
    };
  }

  /** チャット入力ペインの幅を--chat-pane-width に書き込む。 */
  private setChatPaneWidth(width: number) {
    let clamped = MathUtil.clamp(width, this.splitterMinWidth, this.splitterMaxWidth);
    this.elementRef.nativeElement.style.setProperty('--chat-pane-width', clamped + 'px');
  }

  /**
   * 選択中のコマ・部位がテーブルインベントリから外れていたら選び直す。
   * 消えた部位や、多部位になったコマを指していたら、同じコマの先頭の部位へ寄せる
   */
  private validateSelectedIdentifier() {
    let next = resolveSelection(this.gameCharacters, this.selectedIdentifier, this.lastCharacterIdentifier);
    let identifier = next ? next.identifier : '';
    if (identifier !== this.selectedIdentifier) this.selectedIdentifier = identifier;
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    if (this.splitterInput) this.splitterInput.destroy();
  }

  /** エディタへ渡す選択中コマのデータを組み直す */
  private updateSelection() {
    this._resourceOptions = ResourceCommand.expandTargets(getUnitDataTags(this.inventoryService, this.selectedIdentifier));
    this.updateSelectedBuffs();
  }

  /** バフだけを組み直す。 */
  private updateSelectedBuffs() {
    this._selectedBuffs = getUnitBuffs(this.selectedIdentifier);
  }

  isEditorVisible(name: EditorName): boolean {
    // column モードはタブで1つだけ、row モードは畳んでいないものを全部
    return this.dashboardMode === 'row' ? !this.collapsedEditors.has(name) : this.editorTab === name;
  }

  isEditorCollapsed(name: EditorName): boolean {
    return this.collapsedEditors.has(name);
  }

  toggleEditor(name: EditorName): void {
    if (this.collapsedEditors.has(name)) {
      this.collapsedEditors.delete(name);
    } else {
      this.collapsedEditors.add(name);
    }
  }

  appendToText(text: string): void {
    this.text += (/\s$/.test(this.text) || this.text.length === 0 ?  '' : ' ') + text + ' ';
    // ngModel が textarea へ書き戻したあとでないと scrollHeight が伸びない
    setTimeout(() => this.calcFitHeight());
  }

  sendChat(event: Partial<KeyboardEvent>) {
    if (event) event.preventDefault();

    if (!this.text.length) return;
    if (event && event.keyCode !== 13) return;
    if (!this.chatTab) return;

    // テーブルにコマが1つも無いならピア自身を発言者にする。
    let sendFrom = this.selectedIdentifier || this.myPeer.identifier;
    // ターゲット参照を含む発言は1体1通に分かれる
    let deps = { chatMessageService: this.chatMessageService, chatTab: this.chatTab };
    let envelope = { text: this.text, gameType: this.gameType, sendFrom: sendFrom, sendTo: this.sendTo };
    sendPaletteMessages(deps, this.selectedUnit, envelope, this.targetingService.getTargets());

    this.history.push(this.text);
    this.text = '';
    this.writing.sync(0);
    let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    textArea.value = '';
    this.calcFitHeight();
  }

  onInput() {
    this.writing.notify(this.text, this.chatTabidentifier, this.sendTo);
    this.calcFitHeight();
  }

  calcFitHeight() {
    let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    textArea.style.height = '';
    if (textArea.scrollHeight >= textArea.offsetHeight) {
      textArea.style.height = textArea.scrollHeight + 'px';
    }
  }

  moveHistory(event: Partial<KeyboardEvent>, direction: number) {
    if (event) event.preventDefault();

    this.text = this.history.move(direction);
    this.writing.sync(this.text.length);
  }

  /** 選択されたゲームシステムを先読みして、初回のダイスロールを待たせない */
  loadDiceBot(gameType: string) {
    DiceBot.getHelpMessage(gameType);
  }

  showDicebotHelp() {
    openDicebotHelp(this.gameType, this.panelService, this.pointerDeviceService);
  }

}
