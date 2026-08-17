import { BuffCommand } from '@udonarium/buff-command';
import { DataElement } from '@udonarium/data-element';
import { ResourceCommand } from '@udonarium/resource-command';
import { ContextMenuAction, ContextMenuService } from 'service/context-menu.service';
import { PointerDeviceService } from 'service/pointer-device.service';

export interface BuffEffectResourceMenuDeps {
  contextMenuService: ContextMenuService;
  pointerDeviceService: PointerDeviceService;
}

/**
 * 効果欄へリソース名を挿入するメニューを開く。
 */
export function openBuffEffectResourceMenu(
  deps: BuffEffectResourceMenuDeps,
  input: HTMLInputElement,
  effect: string,
  resourceOptions: DataElement[],
  onInsert: (effect: string, caret: number) => void
): void {
  // 未フォーカスでも selectionStart は 0 を返すため、先頭と区別がつかない
  let focused = document.activeElement === input;
  let start = focused ? input.selectionStart : input.value.length;
  let end = focused ? input.selectionEnd : start;
  let text = effect != null ? effect : '';

  let names = insertableResourceNames(resourceOptions);
  let actions: ContextMenuAction[] = 0 < names.length
    ? names.map(name => ({
      name: name,
      action: () => onInsert(text.slice(0, start) + name + text.slice(end), start + name.length),
    }))
    : [{ name: '挿入できるリソースがありません', action: () => { } }];

  deps.contextMenuService.open(deps.pointerDeviceService.pointers[0], actions, '効果に挿入');
}

/** コマンドに書ける名前だけを候補にする。同名タグはひとつにまとめる */
function insertableResourceNames(resourceOptions: DataElement[]): string[] {
  let names = resourceOptions
    // 数値として読めないタグは、挿しても BuffList.applyEffect が書き込めない
    .filter(tag => ResourceCommand.isOperableTarget(tag))
    .map(tag => tag.name != null ? tag.name.trim() : '')
    .filter(name => BuffCommand.isInsertableEffectTarget(name));
  return Array.from(new Set(names));
}
