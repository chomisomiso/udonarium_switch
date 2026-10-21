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

/** {名前} の引き先。DataElement はそのまま満たす。多部位コマの部位は部位→キャラ名の合成 */
export interface VariableSource {
  getFirstElementByName(name: string, option?: CompareOption): DataElement | null;
}

/** 展開結果と、ターゲット参照（t{}）を踏んだか */
export interface PaletteExpansion {
  text: string;
  usedTarget: boolean;
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
   * g フラグ付きだが replace() は lastIndex を残さないので使い回してよい（test() は不可）。
   */
  private static readonly NOTATION = /([tTｔＴ]?)[{｛]\s*([^{}｛｝\^＾]+)([\^＾]*)\s*[}｝]/g;

  evaluate(line: PaletteLine, extendVariables?: VariableSource): string
  evaluate(line: string, extendVariables?: VariableSource, targetVariables?: VariableSource): string
  evaluate(line: any, extendVariables?: VariableSource, targetVariables?: VariableSource): string {
    return this.expand(typeof line === 'string' ? line : line.palette, extendVariables, targetVariables).text;
  }

  /**
   * 展開しつつ、ターゲット参照を踏んだかを併せて返す。
   *
   * 事前にテキストを走査して t{} の有無を調べる方式だと、パレット変数の中に隠れた
   * t{} を取りこぼす（変数は展開して初めて現れる）。展開そのものに報告させる。
   */
  expand(line: string, extendVariables?: VariableSource, targetVariables?: VariableSource): PaletteExpansion {
    let usedTarget = false;
    let evaluate: string = line;

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
        // t{} はターゲットのデータ要素だけを見る。パレット変数は引かない
        if (target) {
          // 解決できたかは問わない。踏んだ時点でターゲットごとの展開が要る
          usedTarget = true;
        } else {
          for (let variable of this.paletteVariables) {
            if (variable.name == name) return variable.value;
          }
        }
        let variables = target ? targetVariables : extendVariables;
        if (variables) {
          let element = variables.getFirstElementByName(name, CompareOption.IgnoreWidth);
          if (element) return element.isNumberResource ? max ? element.value + '' : element.currentValue + '' : element.value + '';
        }
        return '';
      });
      if (limit < loop) isContinue = false;
    }
    return { text: evaluate, usedTarget: usedTarget };
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
