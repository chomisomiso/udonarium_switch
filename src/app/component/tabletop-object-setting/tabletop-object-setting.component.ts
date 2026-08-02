import { Component, Input, OnDestroy, OnInit } from '@angular/core';

import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';
import { TabletopObject } from '@udonarium/tabletop-object';
import { TextNote } from '@udonarium/text-note';

import { PanelOption, PanelService } from 'service/panel.service';
import { PointerCoordinate } from 'service/pointer-device.service';

@Component({
  selector: 'tabletop-object-setting',
  templateUrl: './tabletop-object-setting.component.html',
  styleUrls: ['./tabletop-object-setting.component.css']
})
export class TabletopObjectSettingComponent implements OnInit, OnDestroy {

  /** 各オブジェクトのコンテキストメニューやシートから設定ウィンドウを開く */
  static open(panelService: PanelService, tabletopObject: TabletopObject, coordinate: PointerCoordinate): TabletopObjectSettingComponent {
    EventSystem.trigger('SELECT_TABLETOP_OBJECT', { identifier: tabletopObject.identifier, className: tabletopObject.aliasName });

    let title = '設定';
    let objectName = TabletopObjectSettingComponent.getObjectName(tabletopObject);
    if (objectName.length) title += ' - ' + objectName;

    let height = TabletopObjectSettingComponent.getPanelHeight(tabletopObject.aliasName);
    let option: PanelOption = { title: title, left: coordinate.x - 210, top: coordinate.y - 110, width: 420, height: height };
    let component = panelService.open<TabletopObjectSettingComponent>(TabletopObjectSettingComponent, option);
    component.tabletopObject = tabletopObject;
    return component;
  }

  /** 全オブジェクト共通の設定行数（ポップアップ横幅・縦幅最大） */
  private static readonly commonSettingRowCount: number = 2;
  /** 種別固有の設定行数（`aliasName` → 行数）。設定項目を追加・削除したらここも更新する */
  private static readonly objectSettingRowCount: { [aliasName: string]: number } = {
    'character': 4, // インベントリ非表示 / 発言しない / コマ画像の高さを指定 / コマ画像の高さ
    'text-note': 1, // 高さ制限
  };
  private static readonly settingRowHeight: number = 25;
  /** 設定行以外（タイトルバーやパネルの余白）が占める高さ */
  private static readonly panelChromeHeight: number = 170;

  /**
   * 設定項目が収まるようにパネル高さを見積る。
   * 条件付きで表示される行も常に数えるため、多少余る場合がある。
   */
  private static getPanelHeight(aliasName: string): number {
    let rowCount = this.commonSettingRowCount + (this.objectSettingRowCount[aliasName] ?? 0);
    return this.panelChromeHeight + rowCount * this.settingRowHeight;
  }

  private static getObjectName(tabletopObject: TabletopObject): string {
    if (!tabletopObject?.commonDataElement) return '';
    for (let elementName of ['name', 'title']) {
      let element = tabletopObject.commonDataElement.getFirstElementByName(elementName);
      if (element && element.value != null) return element.value + '';
    }
    return '';
  }

  @Input() tabletopObject: TabletopObject = null;

  get textNote(): TextNote { return this.tabletopObject as TextNote; }
  get gameCharacter(): GameCharacter { return this.tabletopObject as GameCharacter; }

  get minWidth(): number { return TabletopObject.minOverViewWidth; }
  get maxWidth(): number { return TabletopObject.maxOverViewWidth; }
  get minMaxHeight(): number { return TabletopObject.minOverViewMaxHeight; }
  get maxMaxHeight(): number { return TabletopObject.maxOverViewMaxHeight; }

  get minKomaImageHeight(): number { return GameCharacter.minKomaImageHeight; }
  get maxKomaImageHeight(): number { return GameCharacter.maxKomaImageHeight; }

  constructor(
    private panelService: PanelService
  ) { }

  ngOnInit() {
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', event => {
        if (this.tabletopObject && this.tabletopObject.identifier === event.data.identifier) {
          this.panelService.close();
        }
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }
}
