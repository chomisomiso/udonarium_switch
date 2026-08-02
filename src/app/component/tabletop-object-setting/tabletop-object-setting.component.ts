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

    let option: PanelOption = { title: title, left: coordinate.x - 210, top: coordinate.y - 110, width: 420, height: 220 };
    let component = panelService.open<TabletopObjectSettingComponent>(TabletopObjectSettingComponent, option);
    component.tabletopObject = tabletopObject;
    return component;
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
