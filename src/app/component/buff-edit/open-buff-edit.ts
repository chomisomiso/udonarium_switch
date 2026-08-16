import { Buff } from '@udonarium/buff';
import { BuffEditComponent } from 'component/buff-edit/buff-edit.component';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

export interface OpenBuffEditDeps {
  panelService: PanelService;
  pointerDeviceService: PointerDeviceService;
}

/** バフ編集パネルを開く。カード一覧とバフエディタの双方から開くので、位置決めと入力の受け渡しを一箇所に置く。 */
export function openBuffEditPanel(
  deps: OpenBuffEditDeps,
  characterIdentifier: string,
  buff: Buff
): void {
  let coordinate = deps.pointerDeviceService.pointers[0];
  let option: PanelOption = {
    left: Math.max(0, coordinate.x - 200), top: Math.max(0, coordinate.y - 60), width: 380, height: 240
  };
  let component = deps.panelService.open<BuffEditComponent>(BuffEditComponent, option);
  component.characterIdentifier = characterIdentifier;
  component.buffIdentifier = buff.identifier;
}
