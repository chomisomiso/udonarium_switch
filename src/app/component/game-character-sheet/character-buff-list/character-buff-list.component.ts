import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Buff } from '@udonarium/buff';
import { CharacterUnit } from '@udonarium/character-part/character-unit';
import { EventSystem } from '@udonarium/core/system';

import { openBuffEditPanel } from 'component/buff-edit/open-buff-edit';
import { PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

/** キャラクターシートに出すバフの一覧。編集・追加はバフ編集パネルに任せる。*/
@Component({
  selector: 'character-buff-list',
  templateUrl: './character-buff-list.component.html',
  styleUrls: ['./character-buff-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CharacterBuffListComponent implements OnChanges, OnDestroy {
  /** バフの持ち主。単部位コマか、多部位コマの部位 */
  @Input() unit: CharacterUnit = null;

  get buffs(): Buff[] { return this.unit ? this.unit.buffs : []; }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
  ) { }

  /** バフの変化はこのコマ（部位）まで遡って通知される。character-image-list と同じ形 */
  ngOnChanges(): void {
    EventSystem.unregister(this);
    EventSystem.register(this)
      .on(`UPDATE_OBJECT_CHILDREN/identifier/${this.unit?.identifier}`, event => {
        this.changeDetector.markForCheck();
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  trackByBuff(index: number, item: Buff): string { return item.identifier; }

  editTitle(buff: Buff): string {
    return `クリックで編集: ${buff.buffName} ${buff.roundText}`;
  }

  /** buff が null なら新規追加 */
  openEdit(buff: Buff | null): void {
    if (!this.unit) return;

    let deps = { panelService: this.panelService, pointerDeviceService: this.pointerDeviceService };
    openBuffEditPanel(deps, this.unit.identifier, buff);
  }
}
