import { Network } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';

import { CharacterImageListComponent } from 'component/character-image-list/character-image-list.component';
import { ChatPaletteComponent } from 'component/chat-palette/chat-palette.component';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { TabletopObjectSettingComponent } from 'component/tabletop-object-setting/tabletop-object-setting.component';
import { ContextMenuAction, ContextMenuSeparator, ContextMenuType } from 'service/context-menu.service';
import { ImageService } from 'service/image.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

export interface GameCharacterContextMenuDeps {
  panelService: PanelService;
  pointerDeviceService: PointerDeviceService;
  imageService: ImageService;
}

export interface GameCharacterContextMenuOption {
  hideKomaHeight?: boolean;
  gridSize?: number;
}

/**
 * キャラクターに対するコンテキストメニューのビルダー
 * `GameCharacterComponent.makeContextMenu` から抽出
 */
export class GameCharacterContextMenu {
  static make(
    gameCharacter: GameCharacter,
    deps: GameCharacterContextMenuDeps,
    option: GameCharacterContextMenuOption = {}
  ): ContextMenuAction[] {
    let gridSize = option.gridSize ?? 50;
    let actions: ContextMenuAction[] = [];

    actions.push({ name: '詳細を表示', action: () => { GameCharacterContextMenu.showDetail(gameCharacter, deps); } });
    actions.push({ name: 'チャットパレットを表示', action: () => { GameCharacterContextMenu.showChatPalette(gameCharacter, deps); } });
    actions.push(ContextMenuSeparator);
    actions.push({
      name: '共有イベントリに移動', action: () => {
        gameCharacter.setLocation('common');
        SoundEffect.play(PresetSound.piecePut);
      }
    });
    actions.push({
      name: '個人イベントリに移動', action: () => {
        gameCharacter.setLocation(Network.peerId);
        SoundEffect.play(PresetSound.piecePut);
      }
    });
    actions.push({
      name: '墓場に移動', action: () => {
        gameCharacter.setLocation('graveyard');
        SoundEffect.play(PresetSound.sweep);
      }
    });
    if (1 < gameCharacter.imageCount) {
      actions.push(ContextMenuSeparator);
      // action を持たせないことで、親項目のクリックではメニューが閉じないようにする
      actions.push({
        name: '画像',
        subActions: CharacterImageListComponent.makeContextMenuActions(gameCharacter, deps.imageService)
      });
    }
    if (!option.hideKomaHeight) {
      actions.push(ContextMenuSeparator);
      actions.push(gameCharacter.isKomaImageHeightSpecified
        ? { name: '☑ 画像の高さを指定', action: () => { gameCharacter.isKomaImageHeightSpecified = false; } }
        : { name: '☐ 画像の高さを指定', action: () => { gameCharacter.isKomaImageHeightSpecified = true; } });
      if (gameCharacter.isKomaImageHeightSpecified) {
        actions.push({
          name: '高さ',
          type: ContextMenuType.SLIDER,
          slider: {
            min: GameCharacter.minKomaImageHeight,
            max: GameCharacter.maxKomaImageHeight,
            step: 5,
            value: gameCharacter.komaImageHeight,
            onInput: value => gameCharacter.komaImageHeight = value
          }
        });
      }
    }
    actions.push(ContextMenuSeparator);
    actions.push({
      name: 'コピーを作る', action: () => {
        let cloneObject = gameCharacter.clone();
        cloneObject.location.x += gridSize;
        cloneObject.location.y += gridSize;
        cloneObject.update();
        SoundEffect.play(PresetSound.piecePut);
      }
    });
    actions.push(ContextMenuSeparator);
    actions.push({ name: '設定', action: () => TabletopObjectSettingComponent.open(deps.panelService, gameCharacter, deps.pointerDeviceService.pointers[0]) });
    return actions;
  }

  private static showDetail(gameObject: GameCharacter, deps: GameCharacterContextMenuDeps) {
    let coordinate = deps.pointerDeviceService.pointers[0];
    let title = 'キャラクターシート';
    if (gameObject.name.length) title += ' - ' + gameObject.name;
    let option: PanelOption = { title: title, left: coordinate.x - 400, top: coordinate.y - 300, width: 800, height: 600 };
    let component = deps.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, option);
    component.tabletopObject = gameObject;
  }

  private static showChatPalette(gameObject: GameCharacter, deps: GameCharacterContextMenuDeps) {
    let coordinate = deps.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x - 250, top: coordinate.y - 175, width: 615, height: 350 };
    let component = deps.panelService.open<ChatPaletteComponent>(ChatPaletteComponent, option);
    component.character = gameObject;
  }
}
