import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChatPalette } from '@udonarium/chat-palette';
import { ChatTab } from '@udonarium/chat-tab';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';
import { PeerCursor } from '@udonarium/peer-cursor';
import { ChatInputComponent } from 'component/chat-input/chat-input.component';
import { ChatMessageService } from 'service/chat-message.service';
import { DiceBot } from '@udonarium/dice-bot';
import { PanelService } from 'service/panel.service';
import { openPaletteIndexMenu } from 'component/chat-palette/palette-index';
import { getPaletteTopLine, scrollPaletteToLine } from 'component/chat-palette/palette-scroll';
import { ContextMenuService } from 'service/context-menu.service';
import { PointerDeviceService } from 'service/pointer-device.service';

@Component({
  selector: 'chat-palette',
  templateUrl: './chat-palette.component.html',
  styleUrls: ['./chat-palette.component.css']
})
export class ChatPaletteComponent implements OnInit, OnDestroy {
  @ViewChild('chatInput', { static: true }) chatInputComponent: ChatInputComponent;
  @ViewChild('chatPlette') chatPletteElementRef: ElementRef<HTMLSelectElement>;
  @ViewChild('paletteTextArea') paletteTextAreaElementRef: ElementRef<HTMLTextAreaElement>;
  @Input() character: GameCharacter = null;

  get palette(): ChatPalette { return this.character.chatPalette; }

  private _gameType: string = '';
  get gameType(): string { return !this._gameType ? 'DiceBot' : this._gameType; };
  set gameType(gameType: string) {
    this._gameType = gameType;
    if (this.character.chatPalette) this.character.chatPalette.dicebot = gameType;
  };

  get sendFrom(): string { return this.character.identifier; }
  set sendFrom(sendFrom: string) {
    this.onSelectedCharacter(sendFrom);
  }

  chatTabidentifier: string = '';
  text: string = '';
  sendTo: string = '';

  isEdit: boolean = false;
  editPalette: string = '';

  private doubleClickTimer: NodeJS.Timeout = null;

  get diceBotInfos() { return DiceBot.infos }

  get chatTab(): ChatTab { return ObjectStore.instance.get<ChatTab>(this.chatTabidentifier); }
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get otherPeers(): PeerCursor[] { return ObjectStore.instance.getObjects(PeerCursor); }

  /** 索引のもとになる行。編集中はまだ確定していない編集内容を見る */
  private get indexSourceLines(): string[] { return this.isEdit ? this.editPalette.split('\n') : this.palette.getPalette(); }

  constructor(
    public chatMessageService: ChatMessageService,
    private panelService: PanelService,
    private contextMenuService: ContextMenuService,
    private pointerDeviceService: PointerDeviceService,
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => this.updatePanelTitle());
    this.chatTabidentifier = this.chatMessageService.chatTabs ? this.chatMessageService.chatTabs[0].identifier : '';
    this.gameType = this.character.chatPalette ? this.character.chatPalette.dicebot : '';
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', event => {
        if (this.character && this.character.identifier === event.data.identifier) {
          this.panelService.close();
        }
        if (this.chatTabidentifier === event.data.identifier) {
          this.chatTabidentifier = this.chatMessageService.chatTabs ? this.chatMessageService.chatTabs[0].identifier : '';
        }
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    if (this.isEdit) this.setEditMode(false);
  }

  updatePanelTitle() {
    this.panelService.title = this.character.name + ' のチャットパレット';
  }

  onSelectedCharacter(identifier: string) {
    // 別のパレットを表示することになるのでスクロール位置は引き継がない
    if (this.isEdit) this.setEditMode(false);
    let object = ObjectStore.instance.get(identifier);
    if (object instanceof GameCharacter) {
      this.character = object;
      let gameType = this.character.chatPalette ? this.character.chatPalette.dicebot : '';
      if (0 < gameType.length) this.gameType = gameType;
    }
    this.updatePanelTitle();
  }

  selectPalette(line: string) {
    this.text = line;
  }

  clickPalette(line: string) {
    if (this.doubleClickTimer && this.text === line) {
      clearTimeout(this.doubleClickTimer);
      this.doubleClickTimer = null;
      this.chatInputComponent.sendChat(null);
    } else {
      this.text = line;
      this.doubleClickTimer = setTimeout(() => { this.doubleClickTimer = null }, 400);
    }
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

  sendChat(value: { text: string, gameType: string, sendFrom: string, sendTo: string }) {
    if (this.chatTab) {
      let text = this.palette.evaluate(value.text, this.character.rootDataElement);
      this.chatMessageService.sendMessage(this.chatTab, text, value.gameType, value.sendFrom, value.sendTo);
    }
  }

  resetPletteSelect() {
    if (!this.chatPletteElementRef.nativeElement) return;
    this.chatPletteElementRef.nativeElement.selectedIndex = -1;
  }

  /** いま表示されているパレット本体。閲覧時は select、編集時は textarea */
  private get paletteElement(): HTMLSelectElement | HTMLTextAreaElement | null {
    let elementRef = this.isEdit ? this.paletteTextAreaElementRef : this.chatPletteElementRef;
    return elementRef ? elementRef.nativeElement : null;
  }

  toggleEditMode() {
    // select と textarea は *ngIf で入れ替わるので、先頭行を控えて差し替え先へ引き継ぐ
    let topLine = getPaletteTopLine(this.paletteElement);
    this.setEditMode(this.isEdit ? false : true);
    setTimeout(() => scrollPaletteToLine(this.paletteElement, topLine));
  }

  /** 編集モードの出入り。スクロール位置の引き継ぎはしない */
  private setEditMode(isEdit: boolean) {
    this.isEdit = isEdit;
    if (this.isEdit) {
      this.editPalette = this.palette.value + '';
    } else {
      this.palette.setPalette(this.editPalette);
    }
  }
}
