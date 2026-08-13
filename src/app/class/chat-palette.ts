import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { ObjectContext } from './core/synchronize-object/game-object';
import { ObjectNode } from './core/synchronize-object/object-node';
import { CompareOption, StringUtil } from './core/system/util/string-util';
import { DataElement } from './data-element';

export interface PaletteLine {
  palette: string;
}

export interface PaletteVariable {
  name: string;
  value: string;
}

@SyncObject('chat-palette')
export class ChatPalette extends ObjectNode {
  @SyncVar() dicebot: string = 'SwordWorld2.5';
  //TODO: キャラシ項目のコピー

  get paletteLines(): PaletteLine[] {
    if (!this.isAnalized) this.parse(<string>this.value);
    return this._paletteLines;
  }

  get paletteVariables(): PaletteVariable[] {
    if (!this.isAnalized) this.parse(<string>this.value);
    return this._paletteVariables;
  }

  private _palettes: string[] = [];
  private _paletteLines: PaletteLine[] = [];
  private _paletteVariables: PaletteVariable[] = [];
  private isAnalized: boolean = false;

  getPalette(): string[] {
    if (!this.isAnalized) this.parse(<string>this.value);
    return this._palettes;
  }

  setPalette(paletteSource: string) {
    this.value = paletteSource;
    this.isAnalized = false;
  }

  /**
   * 展開対象の記法。先頭の t の有無で参照先が変わる。
   *
   * Result{HP} 等はターゲット参照と誤認されるが仕様として許容する。
   * replace() と matchAll() はどちらも lastIndex を残さないので使い回してよい（test() は不可）。
   */
  private static readonly NOTATION = /([tTｔＴ]?)[{｛]\s*([^{}｛｝\^＾]+)([\^＾]*)\s*[}｝]/g;

  /** t{リソース}（ターゲット参照）を含むか */
  static hasTargetNotation(text: string): boolean {
    return Array.from(text.matchAll(ChatPalette.NOTATION)).some(match => match[1] !== '');
  }

  evaluate(line: PaletteLine, extendVariables?: DataElement): string
  evaluate(line: string, extendVariables?: DataElement, targetVariables?: DataElement): string
  evaluate(line: any, extendVariables?: DataElement, targetVariables?: DataElement): string {
    let evaluate: string = '';
    if (typeof line === 'string') {
      evaluate = line;
    } else {
      evaluate = line.palette;
    }

    console.log(evaluate);
    let limit = 128;
    let loop = 0;
    let isContinue = true;
    while (isContinue) {
      loop++;
      isContinue = false;
      evaluate = evaluate.replace(ChatPalette.NOTATION, (match, target, name, max) => {
        name = StringUtil.toHalfWidth(name);
        console.log(name);
        isContinue = true;
        // t{} はターゲットのデータ要素だけを見る。ターゲット側のパレット変数は引かない
        if (target) {
          let element = targetVariables?.getFirstElementByName(name, CompareOption.IgnoreWidth);
          return element ? this.resolveValue(element, !!max) : '';
        }
        for (let variable of this.paletteVariables) {
          if (variable.name == name) return variable.value;
        }
        if (extendVariables) {
          let element = extendVariables.getFirstElementByName(name, CompareOption.IgnoreWidth);
          if (element) return this.resolveValue(element, !!max);
        }
        return '';
      });
      if (limit < loop) isContinue = false;
    }
    return evaluate;
  }

  /** リソースは現在値（useMax なら最大値）、それ以外は値をそのまま */
  private resolveValue(element: DataElement, useMax: boolean): string {
    if (element.isNumberResource) return (useMax ? element.value : element.currentValue) + '';
    return element.value + '';
  }

  private parse(paletteSource: string) {
    this._palettes = paletteSource.split('\n');

    this._paletteLines = [];
    this._paletteVariables = [];

    for (let palette of this._palettes) {
      let variable = this.parseVariable(palette);
      if (variable) {
        this._paletteVariables.push(variable);
        continue;
      }
      let line: PaletteLine = { palette: palette };
      this._paletteLines.push(line);
    }
    this.isAnalized = true;
  }

  private parseVariable(palette: string): PaletteVariable {
    let array = /^\s*[/／]{2}([^=＝{}｛｝\s]+)\s*[=＝]\s*(.+)\s*/gi.exec(palette);
    if (!array) return null;
    let variable: PaletteVariable = {
      name: StringUtil.toHalfWidth(array[1]),
      value: array[2]
    }
    return variable;
  }

  // override
  apply(context: ObjectContext) {
    super.apply(context);
    this.isAnalized = false;
  }
}
