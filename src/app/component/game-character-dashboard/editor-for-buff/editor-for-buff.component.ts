import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Buff } from '@udonarium/buff';
import { BuffCommand, BuffCommandTarget } from '@udonarium/buff-command';
import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { DataElement } from '@udonarium/data-element';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatMessageService } from 'service/chat-message.service';
import { ContextMenuService } from 'service/context-menu.service';
import { GameCharacterTargetingService } from 'service/game-character-targeting.service';
import { PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { openBuffEditPanel } from 'component/buff-edit/open-buff-edit';
import { openBuffEffectResourceMenu } from 'component/buff-edit/buff-effect-resource-menu';

@Component({
  selector: 'editor-for-buff',
  templateUrl: './editor-for-buff.component.html',
  styleUrls: ['../dashboard-shared.css', './editor-for-buff.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorForBuffComponent {
  @Input() selectedIdentifier: string = '';
  /** バフの変化は親が購読している */
  @Input() buffs: Buff[] = [];
  /** 効果欄へ挿入できるリソースの候補。選択中コマのぶんを親から受け取る */
  @Input() resourceOptions: DataElement[] = [];
  @Input() chatTab: ChatTab | null = null;
  @Output() commandCopy = new EventEmitter<string>();

  @ViewChild('effectInput') private effectInputRef: ElementRef<HTMLInputElement>;

  targetMode: BuffCommandTarget = 'self';
  buffName: string = '';
  /** 残りラウンド。null は無制限（buff-edit と同じ番兵）。0 は「即期限切れ」の意味になる */
  buffRound: number | null = null;
  buffEffect: string = '';

  get targetCharacters(): ReadonlySet<CharacterUnit> {
    return this.targetingService.getTargets();
  }

  /** 発言に載せるダイスボット。切り替えは親のダッシュボードが持つ */
  get gameType(): string { return !this.chatMessageService.gameType ? 'DiceBot' : this.chatMessageService.gameType; }

  get addCommand(): string { return this.makeAddCommand() ?? ''; }
  get addCommandTitle(): string { return 'クリックで入力欄へコピー\n' + this.addCommand; }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private contextMenuService: ContextMenuService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
    private targetingService: GameCharacterTargetingService,
    public chatMessageService: ChatMessageService,
  ) {}

  addBuff(): void {
    if (!this.sendCommand(this.makeAddCommand())) return;
    this.buffName = '';
    this.buffRound = null;
    this.buffEffect = '';
  }

  addBuffCommandToText(): void {
    const command = this.makeAddCommand();
    if (!command) return;
    this.commandCopy.emit(command);
  }

  /**
   * バフの編集ウィンドウを開く。
   */
  openBuffEdit(buff: Buff, event: MouseEvent): void {
    event.stopPropagation();

    let deps = { panelService: this.panelService, pointerDeviceService: this.pointerDeviceService };
    openBuffEditPanel(deps, this.selectedIdentifier, buff);
  }

  progressRound(): void {
    this.sendCommand(BuffCommand.makeProgressRound(this.targetMode));
  }

  isCommandDisabled(): boolean {
    return this.targetMode === 'target' && this.targetCharacters.size === 0;
  }

  /** バフタグのツールチップ */
  editBuffTitle(buff: Buff): string {
    return `クリックで編集: ${buff.buffName} ${buff.roundText}${buff.effect ? ' ' + buff.effect : ''}`;
  }

  trackByIdentifier(index: number, item: Buff): string {
    return item.identifier;
  }

  adjustRoundOnWheel(event: WheelEvent): void {
    event.preventDefault();
    this.buffRound = Buff.stepRounds(this.buffRound, event.deltaY > 0 ? -1 : 1);
  }

  setRoundInfinite(): void {
    this.buffRound = null;
  }

  /** 効果欄へリソース名を挿入するメニューを開く */
  openResourceMenu(event: MouseEvent): void {
    event.stopPropagation();

    let input = this.effectInputRef.nativeElement;
    let deps = { contextMenuService: this.contextMenuService, pointerDeviceService: this.pointerDeviceService };
    openBuffEffectResourceMenu(deps, input, this.buffEffect, this.resourceOptions, (effect, caret) => {
      this.buffEffect = effect;
      this.changeDetector.markForCheck();
      // ngModel が値を書き戻す前に動かすとキャレット位置がずれる
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(caret, caret);
      });
    });
  }

  /** コマンドを発言する。送れなかった場合は false */
  private sendCommand(commandText: string | null): boolean {
    if (!this.chatTab || !commandText) return false;
    if (this.targetMode === 'target' && this.targetCharacters.size === 0) return false;
    this.chatMessageService.sendMessage(this.chatTab, commandText, this.gameType, this.selectedIdentifier, '', this.targetCharacters);
    return true;
  }

  /** 入力欄の内容から追加コマンドを組み立てる。組み立てられない場合は null */
  private makeAddCommand(): string | null {
    if (this.targetMode === 'target' && this.targetCharacters.size === 0) return null;
    return BuffCommand.makeAdd({
      name: this.buffName,
      round: this.buffRound,
      effect: this.buffEffect,
      target: this.targetMode,
    });
  }
}
