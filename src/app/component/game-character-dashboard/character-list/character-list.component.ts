import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Buff } from '@udonarium/buff';
import { DataElement } from '@udonarium/data-element';
import { DoublePressDetector } from '@udonarium/double-press';
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

/** カードのダブルクリック判定の間隔。単クリックの選択はこのぶん遅れる */
const CARD_DOUBLE_CLICK_MS = 300;

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
    this.doublePress.cancel();
  }

  selectCharacter(character: GameCharacter): void {
    this.selectedIdentifier = character.identifier;
    this.selectedIdentifierChange.emit(this.selectedIdentifier);
  }

  // ===== カードのクリック =====
  // 選択はそのまま発言者になるので、ダブルクリック（ターゲット切替）で選択が動いてはならない。
  // click は dblclick より先に飛ぶため、単クリックの選択は2回目が来ないと確定するまで遅らせる
  private doublePress = new DoublePressDetector(CARD_DOUBLE_CLICK_MS);

  onCardClick(e: MouseEvent, character: GameCharacter): void {
    // タッチは double-tap が不安定なので遅らせず即選択する（ターゲットはバッジで切り替える）
    if ((e as PointerEvent).pointerType === 'touch') {
      this.doublePress.cancel();
      this.selectCharacter(character);
      return;
    }
    let isDouble = this.doublePress.press(character.identifier, () => {
      this.selectCharacter(character);
      this.changeDetector.markForCheck();
    });
    if (isDouble) this.toggleTarget(character);
  }

  /** ダブルクリックでキャラ名などの文字が選択されるのを防ぐ（入力欄の単語選択は残す） */
  onCardMouseDown(e: MouseEvent): void {
    if (1 < e.detail && !(e.target as HTMLElement).closest('input, textarea')) e.preventDefault();
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
