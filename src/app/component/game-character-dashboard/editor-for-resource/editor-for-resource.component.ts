import { Component, ChangeDetectionStrategy, ChangeDetectorRef, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { ChatTab } from '@udonarium/chat-tab';
import { EventSystem } from '@udonarium/core/system';
import { DataElement } from '@udonarium/data-element';
import { ResourceCommand } from '@udonarium/resource-command';
import { getCharacter } from 'component/game-character-dashboard/character-tags';
import { sendPaletteMessages } from 'component/chat-palette/palette-message';
import { ChatMessageService } from 'service/chat-message.service';
import { GameCharacterTargetingService } from 'service/game-character-targeting.service';

/** 同名タグをひとつにまとめる */
function distinctByName(tags: DataElement[]): DataElement[] {
  let names = new Set<string>();
  return tags.filter(tag => {
    let name = tag.name.trim();
    if (names.has(name)) return false;
    names.add(name);
    return true;
  });
}

@Component ({
  selector: 'editor-for-resource',
  templateUrl: './editor-for-resource.component.html',
  styleUrls: ['../dashboard-shared.css', './editor-for-resource.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorForResourceComponent implements OnInit, OnDestroy {
  @Input() selectedIdentifier: string = '';
  @Input() set resourceOptions(options: DataElement[]) {
    let candidates = (options ?? []).filter(tag =>
      ResourceCommand.isValidResourceName(tag.name) && ResourceCommand.isOperableTarget(tag));
    this._resourceOptions = distinctByName(candidates);
    this._maxResourceOptions = distinctByName(candidates.filter(tag => tag.isNumberResource));
    this.pruneSelection();
  }
  private _resourceOptions: DataElement[] = [];
  private _maxResourceOptions: DataElement[] = [];

  @Input() chatTab: ChatTab | null = null;
  @Output() commandCopy = new EventEmitter<string>();

  keypadValue: number = 0;
  rangeLimit: boolean = false;
  isTargetMode: boolean = false;

  selectedResourceKey: string = '';
  private get isMaxValue(): boolean { return ResourceCommand.parseResourceKey(this.selectedResourceKey).isMaxValue; }
  private get selectingResourceName(): string { return ResourceCommand.parseResourceKey(this.selectedResourceKey).name; }

  /** 現在値を最大値で満たす。増減値ではなく `{HP^}` 参照の代入になるので、対象は最大値を持つリソースだけに絞る
   */
  get fillToMax(): boolean { return this._fillToMax && this.canFillToMax; }
  set fillToMax(fillToMax: boolean) {
    this._fillToMax = fillToMax;
    // 最大値そのものの操作とは併用できないので `^` を落としてから絞り直す
    if (fillToMax && this.isMaxValue) this.selectedResourceKey = this.selectingResourceName;
    this.pruneSelection();
  }
  private _fillToMax: boolean = false;

  /** 選択中のリソースが今の候補に無ければ落とす */
  private pruneSelection(): void {
    this.selectedResourceKey =
      ResourceCommand.pruneResourceKey(this.selectedResourceKey, this.currentValueOptions, this.maxValueOptions);
  }

  /** 満タン中は最大値を持つリソースだけが対象になる */
  get currentValueOptions(): DataElement[] { return this._fillToMax ? this._maxResourceOptions : this._resourceOptions; }
  /** 満タン中は最大値の選択肢を畳む */
  get maxValueOptions(): DataElement[] { return this._fillToMax ? [] : this._maxResourceOptions; }

  get gameType(): string { return !this.chatMessageService.gameType ? 'DiceBot' : this.chatMessageService.gameType; }

  get command(): string { return this.makeResourceCommand() ?? ''; }
  get commandTitle(): string { return 'クリックで入力欄へコピー\n' + this.command; }

  get targetCharacters(): ReadonlySet<CharacterUnit> {
    return this.targetingService.getTargets();
  }

  get fillOptionTitle(): string {
    if (!this.canFillToMax) return '発言者がチャットパレットを持たないため、最大値を参照できません';
    return '現在値を最大値まで戻す';
  }

  /** 満タンは `{HP^}` 参照記法に乗るので、発言者のパレットを通らないと展開されない。 */
  get canFillToMax(): boolean {
    let character = getCharacter(this.selectedIdentifier);
    return character != null && character.chatPalette != null;
  }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private targetingService: GameCharacterTargetingService,
    public chatMessageService: ChatMessageService,
  ) {}

  ngOnInit() {
    // DataElement の変更は inventoryService が UPDATE_INVENTORY にまとめて流す
    EventSystem.register(this)
      .on('UPDATE_INVENTORY', event => {
        this.changeDetector.markForCheck();
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  selectResourceOnWheel(event: WheelEvent): void {
    // 横チルト・shift+ホイールは拾わない（step の符号が意図せず負に倒れる）
    if (event.deltaY === 0) return;
    event.preventDefault();
    let select = event.currentTarget as HTMLSelectElement;
    let step = 0 < event.deltaY ? 1 : -1;
    // 未選択（selectedIndex < 0）は送る向きに応じて端から入る
    let next = select.selectedIndex < 0
      ? (0 < step ? 0 : select.options.length - 1)
      : select.selectedIndex + step;
    // プレースホルダは disabled なので飛ばす
    while (0 <= next && next < select.options.length && select.options[next].disabled) next += step;
    if (next < 0 || select.options.length <= next) return;
    this.selectedResourceKey = select.options[next].value;
  }

  sendResourceCommand() {
    const command = this.makeResourceCommand();
    if (!command || !this.chatTab) return;
    // 満タンの `{HP^}` はパレット経由でしか展開されない。
    // ターゲット参照を含む発言をターゲットごとに分けるのも、この経路が持つ
    sendPaletteMessages(
      { chatMessageService: this.chatMessageService, chatTab: this.chatTab },
      CharacterUnit.resolve(this.selectedIdentifier),
      { text: command, gameType: this.gameType, sendFrom: this.selectedIdentifier, sendTo: '' },
      this.targetCharacters);
  }

  addResourceCommandToText() {
    const command = this.makeResourceCommand();
    if (!command) return;
    this.commandCopy.emit(command);
  }

  /** 選択中のリソースと入力値からコマンドを組み立てる。組み立てられない場合は null */
  private makeResourceCommand(): string | null {
    if (this.isTargetMode && this.targetCharacters.size === 0) return null;
    return ResourceCommand.make({
      resourceName: this.selectingResourceName,
      value: this.keypadValue,
      isTargetMode: this.isTargetMode,
      isMaxValue: this.isMaxValue,
      rangeLimit: this.rangeLimit,
      fillToMax: this.fillToMax,
    });
  }

  adjustValue(amount: number): void {
    this.keypadValue += amount;
  }
  adjustValueOnKeypadWheel(event: WheelEvent): void {
    event.preventDefault();
    this.keypadValue += event.deltaY > 0 ? -1 : 1;
  }
  clearValue(): void {
    this.keypadValue = 0;
  }

  trackByDataElement(index: number, item: DataElement): string {
    return item.identifier;
  }
}