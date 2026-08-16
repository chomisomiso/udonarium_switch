import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Buff } from '@udonarium/buff';
import { BuffCommand } from '@udonarium/buff-command';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { ResourceCommand } from '@udonarium/resource-command';
import { EventSystem } from '@udonarium/core/system';
import { ContextMenuService } from 'service/context-menu.service';
import { GameObjectInventoryService } from 'service/game-object-inventory.service';
import { PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { openBuffEffectResourceMenu } from 'component/buff-edit/buff-effect-resource-menu';

export interface CharacterTagsSource {
  readonly tableInventory: { dataElementMap: Map<string, DataElement[]> };
  readonly newLineDataElement: DataElement;
}
/** パネルごとに一意な id を作るための連番 */
let nextBuffEditId = 0;

function getCharacterDataTags(source: CharacterTagsSource, identifier: string): DataElement[] {
  if (!identifier) return [];
  let tags = source.tableInventory.dataElementMap.get(identifier);
  // 改行マーカーはモック要素なのでタグとしては扱わない
  return tags ? tags.filter(tag => tag != null && tag !== source.newLineDataElement) : [];
}

/** バフ 1 つぶんの編集ウィンドウ。バフタグのクリックで開く。 */
@Component({
  selector: 'buff-edit',
  templateUrl: './buff-edit.component.html',
  styleUrls: ['./buff-edit.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BuffEditComponent implements OnInit, OnDestroy {
  @Input() characterIdentifier: string = '';
  @Input() buffIdentifier: string = '';

  @ViewChild('effectInput') private effectInputRef: ElementRef<HTMLInputElement>;

  /** パネルごとに一意なID */
  readonly idPrefix: string = `buff-edit-${nextBuffEditId++}`;

  buffName: string = '';
  /** 残りラウンド。null は無制限 */
  buffRound: number | null = null;
  buffEffect: string = '';

  get character(): GameCharacter | null {
    let object = ObjectStore.instance.get(this.characterIdentifier);
    return object instanceof GameCharacter ? object : null;
  }

  /** 効果欄へ挿入できるリソースの候補。親よりライフサイクルが長いので都度導出する */
  get resourceOptions(): DataElement[] {
    return ResourceCommand.expandTargets(getCharacterDataTags(this.inventoryService, this.characterIdentifier));
  }

  get buff(): Buff | null {
    let object = ObjectStore.instance.get(this.buffIdentifier);
    return object instanceof Buff ? object : null;
  }

  get isRemoved(): boolean {
    let buff = this.buff;
    return buff == null || this.character == null || buff.parent !== this.character.buffList;
  }

  /** 入力が保存できない理由。空文字なら問題なし。 */
  get validationError(): string {
    // 直接書き換えるので文法上は自由だが、コマンドで消せない名前を作らせない
    if (!BuffCommand.isValidName(this.buffName)) return '名前に空白 / & は使えません（末尾の - と D 単独も不可）';
    if (!BuffCommand.isValidEffect(this.buffEffect)) return '効果に空白 / & は使えません';
    if (this.buffRound != null && !Number.isInteger(this.buffRound)) return 'ラウンドは整数で指定してください';
    return '';
  }

  get canSave(): boolean { return !this.isRemoved && this.validationError.length < 1; }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private contextMenuService: ContextMenuService,
    private inventoryService: GameObjectInventoryService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
  ) { }

  ngOnInit() {
    this.load();
    Promise.resolve().then(() => {
      let character = this.character;
      this.panelService.title = character ? `バフ編集 - ${character.name}` : 'バフ編集';
    });
    // 他ピアやダッシュボードからの変更で対象が消えることがある。
    // バフの増減・書き換えは配下のノードの変化としてコマまで遡って通知される。
    // characterIdentifier はパネルを開くときに一度だけ入り、以後変わらない
    EventSystem.register(this)
      .on(`UPDATE_OBJECT_CHILDREN/identifier/${this.characterIdentifier}`, event => {
        this.changeDetector.markForCheck();
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  private load(): void {
    let buff = this.buff;
    if (!buff) return;
    this.buffName = buff.buffName != null ? buff.buffName : '';
    this.buffRound = buff.rounds;
    this.buffEffect = buff.effect != null ? buff.effect : '';
  }

  save(): void {
    if (!this.canSave) return;
    this.character?.buffList?.edit(this.buff, this.buffName.trim(), this.buffRound, this.buffEffect.trim());
    this.panelService.close();
  }

  remove(): void {
    if (this.isRemoved) return;
    this.character.buffList.remove(this.buff);
    this.panelService.close();
  }

  cancel(): void {
    this.panelService.close();
  }

  adjustRoundOnWheel(event: WheelEvent): void {
    event.preventDefault();
    this.buffRound = Buff.stepRounds(this.buffRound, event.deltaY > 0 ? -1 : 1);
  }

  setRoundInfinite(): void {
    this.buffRound = null;
  }

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
}
