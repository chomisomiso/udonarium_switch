import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Buff } from '@udonarium/buff';
import { DataElement } from '@udonarium/data-element';
import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';
import { GameCharacterContextMenu } from 'component/game-character/game-character-context-menu';
import { openBuffEditPanel } from 'component/buff-edit/open-buff-edit';
import {
  calcResourceBarWidth,
  calcResourceMaxValues,
  getCharacterBuffs,
  getCharacterOtherDataTags,
  getCharacterResourceTags,
} from 'component/game-character-dashboard/character-tags';
import { ContextMenuAction, ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { GameCharacterTargetingService } from 'service/game-character-targeting.service';
import { GameObjectInventoryService } from 'service/game-object-inventory.service';
import { ImageService } from 'service/image.service';
import { PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

/**
 * ダッシュボードのキャラクターカード一覧。
 * 表示モードは親がホスト要素へ `mode-*` クラスとして付ける。
 */
@Component({
  selector: 'character-list',
  templateUrl: './character-list.component.html',
  styleUrls: ['../dashboard-shared.css', './character-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CharacterListComponent implements OnInit, OnDestroy {
  /** ダッシュボード全体で選択中のコマ。カードのクリックで切り替える */
  @Input() selectedIdentifier: string = '';
  @Output() selectedIdentifierChange = new EventEmitter<string>();

  private _resourceMaxValues: { [resourceName: string]: number } = {};

  get gameCharacters(): GameCharacter[] { return this.inventoryService.visibleTableCharacters; }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private contextMenuService: ContextMenuService,
    private imageService: ImageService,
    private inventoryService: GameObjectInventoryService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
    private targetingService: GameCharacterTargetingService,
  ) {}

  ngOnInit() {
    this.updateResourceMaxValues();
    EventSystem.register(this)
      .on('UPDATE_INVENTORY', event => {
        this.updateResourceMaxValues();
        this.changeDetector.markForCheck();
      })
      // 追加・編集・削除のいずれも UPDATE_INVENTORY には乗らないため、自分で購読する
      .on(`UPDATE_GAME_OBJECT/aliasName/${Buff.aliasName}`, event => {
        this.changeDetector.markForCheck();
      })
      .on('UPDATE_TARGET', event => {
        this.changeDetector.markForCheck();
      })
      .on('DELETE_GAME_OBJECT', event => {
        this.changeDetector.markForCheck();
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  selectCharacter(character: GameCharacter): void {
    this.selectedIdentifier = character.identifier;
    this.selectedIdentifierChange.emit(this.selectedIdentifier);
  }

  getCharacterResourceTags(identifier: string): DataElement[] {
    return getCharacterResourceTags(this.inventoryService, identifier);
  }

  getCharacterOtherDataTags(identifier: string): DataElement[] {
    return getCharacterOtherDataTags(this.inventoryService, identifier);
  }

  getCharacterBuffs(identifier: string): Buff[] {
    return getCharacterBuffs(identifier);
  }

  private updateResourceMaxValues() {
    this._resourceMaxValues = calcResourceMaxValues(this.inventoryService, this.gameCharacters);
  }

  getResourceBarWidth(tag: DataElement): string {
    return calcResourceBarWidth(tag, this._resourceMaxValues);
  }

  // ===== バフ =====

  buffExpanded: Set<string> = new Set();

  isBuffExpanded(identifier: string): boolean {
    return this.buffExpanded.has(identifier);
  }

  toggleBuffExpanded(identifier: string): void {
    if (this.buffExpanded.has(identifier)) {
      this.buffExpanded.delete(identifier);
    } else {
      this.buffExpanded.add(identifier);
    }
  }

  getBuffSummaryTitle(buffs: Buff[]): string {
    return buffs.map(buff => `${buff.buffName} ： ${buff.roundLabel}`).join('\n');
  }

  openBuffEdit(character: GameCharacter, buff: Buff, event: MouseEvent): void {
    event.stopPropagation();

    let deps = { panelService: this.panelService, pointerDeviceService: this.pointerDeviceService };
    openBuffEditPanel(deps, character.identifier, buff);
  }

  // ===== ターゲット =====
  isTargeting(gameCharacter: GameCharacter): boolean {
    return this.targetingService.has(gameCharacter);
  }

  toggleTarget(character: GameCharacter): void {
    if (this.targetingService.has(character)) this.targetingService.remove(character);
    else this.targetingService.add(character);
  }

  // ===== コンテキストメニュー =====
  onContextMenu(e: Event, gameCharacter: GameCharacter) {
    // 入力欄そのものを右クリックしたときはブラウザ標準メニューを優先する
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    e.stopPropagation();
    e.preventDefault();

    if (!this.pointerDeviceService.isAllowedToOpenContextMenu) return;

    let actions: ContextMenuAction[] = [];
    actions.push({
      name: `${this.isTargeting(gameCharacter) ? '☑' : '☐'} ターゲット`,
      action: () => { this.toggleTarget(gameCharacter); }
    });
    actions.push(ContextMenuSeparator);
    actions = actions.concat(GameCharacterContextMenu.make(gameCharacter, {
      panelService: this.panelService,
      pointerDeviceService: this.pointerDeviceService,
      imageService: this.imageService
    }, { hideKomaHeight: true }));

    this.contextMenuService.open(this.pointerDeviceService.pointers[0], actions, gameCharacter.name);
  }

  trackByIdentifier(index: number, item: GameCharacter): string {
    return item.identifier;
  }

  trackByBuff(index: number, item: Buff): string {
    return item.identifier;
  }
}
