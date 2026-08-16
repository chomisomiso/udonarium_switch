import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Buff } from '@udonarium/buff';
import { EventSystem } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';

import { openBuffEditPanel } from 'component/buff-edit/open-buff-edit';
import { PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

/** キャラクターシートに出すバフの一覧。**読み取り専用**。*/
@Component({
  selector: 'character-buff-list',
  templateUrl: './character-buff-list.component.html',
  styleUrls: ['./character-buff-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CharacterBuffListComponent implements OnChanges, OnDestroy {
  @Input() gameCharacter: GameCharacter = null;

  get buffs(): Buff[] { return this.gameCharacter ? this.gameCharacter.buffs : []; }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
  ) { }

  /** バフの変化はこのコマまで遡って通知される。character-image-list と同じ形 */
  ngOnChanges(): void {
    EventSystem.unregister(this);
    EventSystem.register(this)
      .on(`UPDATE_OBJECT_CHILDREN/identifier/${this.gameCharacter?.identifier}`, event => {
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

  openEdit(buff: Buff): void {
    if (!this.gameCharacter) return;

    let deps = { panelService: this.panelService, pointerDeviceService: this.pointerDeviceService };
    openBuffEditPanel(deps, this.gameCharacter.identifier, buff);
  }
}
