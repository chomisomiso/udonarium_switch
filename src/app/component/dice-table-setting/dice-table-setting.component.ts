import { Component, OnDestroy, OnInit } from '@angular/core';

import { ChatTab } from '@udonarium/chat-tab';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { MathUtil } from '@udonarium/core/system/util/math-util';
import { DiceBot } from '@udonarium/dice-bot';
import { DiceTable } from '@udonarium/dice-table';
import { PeerCursor } from '@udonarium/peer-cursor';

import { ChatMessageService } from 'service/chat-message.service';
import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';
import { SaveDataService } from 'service/save-data.service';

@Component({
  selector: 'dice-table-setting',
  templateUrl: './dice-table-setting.component.html',
  styleUrls: ['./dice-table-setting.component.css']
})
export class DiceTableSettingComponent implements OnInit, OnDestroy {
  private _selectedTable: DiceTable | null = null;

  /**
   * 表が1つでもある限り、必ずいずれかが選択された状態になる。
   * 他ピアによる削除やルーム読込での作り直しでも選択が外れないよう、参照するたびに識別子で引き直して選び直す。
   */
  get selectedTable(): DiceTable | null {
    let selected = this._selectedTable
      ? ObjectStore.instance.get<DiceTable>(this._selectedTable.identifier)
      : null;

    if (!selected) {
      let diceTables = this.diceTables;
      selected = 0 < diceTables.length ? diceTables[0] : null;
    }
    this._selectedTable = selected;
    return selected;
  }
  set selectedTable(diceTable: DiceTable | null) { this._selectedTable = diceTable; }

  /** 「使う」で発言するチャットタブ。このパネル内だけで保持する */
  chatTabidentifier: string = '';

  isSaveing: boolean = false;
  progresPercent: number = 0;

  get diceTables(): DiceTable[] { return ObjectStore.instance.getObjects(DiceTable); }
  get diceBotInfos() { return DiceBot.infos; }

  get chatTabs(): ChatTab[] { return this.chatMessageService.chatTabs; }
  get chatTab(): ChatTab | null { return ObjectStore.instance.get<ChatTab>(this.chatTabidentifier); }

  /** コマンドが未設定の表はチャット経由で呼び出せない */
  get canRoll(): boolean { return 0 < (this.selectedTable?.command.length ?? 0); }

  get tableName(): string { return this.selectedTable?.name ?? ''; }
  set tableName(tableName: string) { let diceTable = this.selectedTable; if (diceTable) diceTable.name = tableName; }

  get tableDice(): string { return this.selectedTable?.dice ?? ''; }
  set tableDice(tableDice: string) { let diceTable = this.selectedTable; if (diceTable) diceTable.dice = tableDice; }

  get tableCommand(): string { return this.selectedTable?.command ?? ''; }
  set tableCommand(tableCommand: string) { let diceTable = this.selectedTable; if (diceTable) diceTable.command = tableCommand; }

  get tableText(): string { return this.selectedTable?.text ?? ''; }
  set tableText(tableText: string) { let diceTable = this.selectedTable; if (diceTable) diceTable.text = tableText; }

  get gameType(): string { return this.selectedTable?.dicebot ?? ''; }
  set gameType(gameType: string) { let diceTable = this.selectedTable; if (diceTable) diceTable.dicebot = gameType; }

  constructor(
    private chatMessageService: ChatMessageService,
    private modalService: ModalService,
    private panelService: PanelService,
    private saveDataService: SaveDataService
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => this.modalService.title = this.panelService.title = 'ダイス表設定');
    // チャットタブは最後の1つを削除できないため、常に先頭が存在する前提でよい
    this.chatTabidentifier = this.chatTabs[0].identifier;
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', event => {
        // 発言先に選んでいたタブが消えたら先頭のタブへ戻す
        if (this.chatTabidentifier === event.data.identifier) {
          this.chatTabidentifier = this.chatTabs[0].identifier;
        }
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  selectDiceTable(diceTable: DiceTable) {
    this.selectedTable = diceTable;
  }

  create() {
    this.selectDiceTable(DiceTable.create());
  }

  /**
   * 表のコマンドをそのままチャットへ発言する。
   * 実際のロールは既存の DiceTableHandler が SEND_MESSAGE で拾って行うので、ここでロール処理を持たない。他プレイヤーにも使ったコマンドが見える。
   */
  roll() {
    let diceTable = this.selectedTable;
    let chatTab = this.chatTab;
    if (!diceTable || !chatTab || !this.canRoll) return;

    // 表のロールにターゲット選択は乗せない（コマンドに t: が混ざっていても選択中の相手へ適用しない）
    this.chatMessageService.sendMessage(
      chatTab, diceTable.command, this.chatMessageService.gameType, PeerCursor.myCursor.identifier, '', []);
  }

  async save() {
    let diceTable = this.selectedTable;
    if (!diceTable || this.isSaveing) return;
    this.isSaveing = true;
    this.progresPercent = 0;

    let fileName: string = 'dice_table_' + diceTable.name;

    await this.saveDataService.saveGameObjectAsync(diceTable, fileName, percent => {
      this.progresPercent = percent;
    });

    setTimeout(() => {
      this.isSaveing = false;
      this.progresPercent = 0;
    }, 500);
  }

  delete() {
    let diceTable = this.selectedTable;
    if (!diceTable) return;

    // 削除後は同じ位置の表へ選択を移す（末尾を消したときは手前へ）
    let index: number = this.diceTables.indexOf(diceTable);
    diceTable.destroy();

    let diceTables = this.diceTables;
    this.selectedTable = 0 < diceTables.length ? diceTables[MathUtil.clamp(index, 0, diceTables.length - 1)] : null;
  }
}
