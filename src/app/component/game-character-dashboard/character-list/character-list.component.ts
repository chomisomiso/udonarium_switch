import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Buff } from '@udonarium/buff';
import { CharacterPart } from '@udonarium/character-part/character-part';
import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { DataElement } from '@udonarium/data-element';
import { DoublePressDetector } from '@udonarium/double-press';
import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';
import { GameCharacterContextMenu } from 'component/game-character/game-character-context-menu';
import { openBuffEditPanel } from 'component/buff-edit/open-buff-edit';
import {
  calcResourceBarWidth,
  calcResourceMaxValues,
  filterOtherDataTags,
  filterResourceTags,
  getCharacterOtherDataTags,
  getCharacterResourceTags,
  getPartDataTags,
  getUnitBuffs,
} from 'component/game-character-dashboard/character-tags';
import { ContextMenuAction, ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { CharacterTargetState, GameCharacterTargetingService } from 'service/game-character-targeting.service';
import { GameObjectInventoryService } from 'service/game-object-inventory.service';
import { ImageService } from 'service/image.service';
import { PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

/** カードのダブルクリック判定の間隔。単クリックの選択はこのぶん遅れる */
const CARD_DOUBLE_CLICK_MS = 300;

/** ターゲット状態の印。バッジとコンテキストメニューで揃える */
function targetMark(state: CharacterTargetState): string {
  switch (state) {
    case 'all': return '☑';
    case 'partial': return '◪';
    default: return '☐';
  }
}

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

  selectUnit(unit: CharacterUnit): void {
    this.selectedIdentifier = unit.identifier;
    this.selectedIdentifierChange.emit(this.selectedIdentifier);
  }

  /** カード（ヘッダ・画像）からの選択。多部位コマは選択中の部位を保ち、他のコマからなら先頭の部位へ */
  selectCharacter(character: GameCharacter): void {
    if (this.hasSelectedPart(character)) return;
    this.selectUnit(CharacterUnit.primaryOf(character));
  }

  /** 選択中の部位がこのコマのものか */
  hasSelectedPart(character: GameCharacter): boolean {
    return character.parts.some(part => part.identifier === this.selectedIdentifier);
  }

  // ===== カードのクリック =====
  // 選択はそのまま発言者になるので、ダブルクリック（ターゲット切替）で選択が動いてはならない。
  // click は dblclick より先に飛ぶため、単クリックの選択は2回目が来ないと確定するまで遅らせる
  private doublePress = new DoublePressDetector(CARD_DOUBLE_CLICK_MS);

  /** カードのダブルクリックはコマ単位の一括切り替え（コマ上のダブルクリックと同じ） */
  onCardClick(e: MouseEvent, character: GameCharacter): void {
    this.handleClick(e, character.identifier,
      () => this.selectCharacter(character),
      () => this.targetingService.toggleCharacter(character));
  }

  /** 部位行は部位単位で選択・ターゲットする */
  onPartClick(e: MouseEvent, part: CharacterPart): void {
    e.stopPropagation();
    this.handleClick(e, part.identifier,
      () => this.selectUnit(part),
      () => this.toggleTarget(part));
  }

  private handleClick(e: MouseEvent, key: string, onSingle: () => void, onDouble: () => void): void {
    // タッチは double-tap が不安定なので遅らせず即選択する（ターゲットはバッジで切り替える）
    if ((e as PointerEvent).pointerType === 'touch') {
      this.doublePress.cancel();
      onSingle();
      return;
    }
    let isDouble = this.doublePress.press(key, () => {
      onSingle();
      this.changeDetector.markForCheck();
    });
    if (isDouble) onDouble();
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

  /** 部位の行に出すのは部位自身のタグだけ。共有のタグはコマの行に一度だけ出す */
  getPartResourceTags(part: CharacterPart): DataElement[] {
    return filterResourceTags(getPartDataTags(this.inventoryService.dataTags, part, true));
  }

  getPartOtherDataTags(part: CharacterPart): DataElement[] {
    return filterOtherDataTags(getPartDataTags(this.inventoryService.dataTags, part, true));
  }

  getUnitBuffs(identifier: string): Buff[] {
    return getUnitBuffs(identifier);
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

  openBuffEdit(unit: CharacterUnit, buff: Buff, event: MouseEvent): void {
    event.stopPropagation();

    let deps = { panelService: this.panelService, pointerDeviceService: this.pointerDeviceService };
    openBuffEditPanel(deps, unit.identifier, buff);
  }

  // ===== ターゲット =====
  isTargeting(unit: CharacterUnit): boolean {
    return this.targetingService.has(unit);
  }

  toggleTarget(unit: CharacterUnit): void {
    if (this.targetingService.has(unit)) this.targetingService.remove(unit);
    else this.targetingService.add(unit);
  }

  targetState(character: GameCharacter): CharacterTargetState {
    return this.targetingService.stateOf(character);
  }

  /** 部位で割れていれば全部外す */
  toggleCharacterTarget(character: GameCharacter): void {
    this.targetingService.toggleCharacter(character);
  }

  targetBadgeLabel(character: GameCharacter): string {
    return `${targetMark(this.targetState(character))} Target`;
  }

  // ===== コンテキストメニュー =====
  onContextMenu(e: Event, gameCharacter: GameCharacter) {
    // 入力欄そのものを右クリックしたときはブラウザ標準メニューを優先する
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    e.stopPropagation();
    e.preventDefault();

    if (!this.pointerDeviceService.isAllowedToOpenContextMenu) return;

    let actions: ContextMenuAction[] = [];
    // 単部位コマなら state は all / none で、一括切り替えはそのコマだけを切り替える
    actions.push({
      name: `${targetMark(this.targetState(gameCharacter))} ターゲット${gameCharacter.isMultiPart ? '（全部位）' : ''}`,
      action: () => { this.toggleCharacterTarget(gameCharacter); }
    });
    for (let part of gameCharacter.parts) {
      actions.push({
        name: `${this.isTargeting(part) ? '☑' : '☐'} ターゲット：${part.partName}`,
        action: () => { this.toggleTarget(part); }
      });
    }
    actions.push(ContextMenuSeparator);
    actions = actions.concat(GameCharacterContextMenu.make(gameCharacter, {
      panelService: this.panelService,
      pointerDeviceService: this.pointerDeviceService,
      imageService: this.imageService
    }, { hideKomaHeight: true }));

    this.contextMenuService.open(this.pointerDeviceService.pointers[0], actions, gameCharacter.name);
  }

  trackByIdentifier(index: number, item: CharacterUnit): string {
    return item.identifier;
  }

  trackByBuff(index: number, item: Buff): string {
    return item.identifier;
  }
}
