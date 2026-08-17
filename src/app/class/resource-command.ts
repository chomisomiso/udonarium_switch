import { CommandToken } from './command-token';
import { StringUtil } from './core/system/util/string-util';
import { DataElement } from './data-element';

/** 発言から読み取ったリソース操作ひとつぶん */
export interface ResourceCommand {
  resource: string;
  operator: string;
  /** オプション文字を取り除いたコマンド本体。BCDice へ渡す整形は実行側の責務 */
  command: string;
  /** コマンド本体が数式・ダイス式か（文字列指定と区別する） */
  isCalculate: boolean;
  enableOptionL: boolean;
  enableOptionZ: boolean;
  enableOptionMax: boolean;
}

export interface ResourceCommandOptions {
  resourceName: string;
  /** 増減値。負数なら減算になる */
  value: number;
  /** ターゲットに対して実行する（`t:` 接頭辞） */
  isTargetMode?: boolean;
  /** 現在値ではなく最大値を操作する（リソース名末尾の `^`） */
  isMaxValue?: boolean;
  /** 適用値が 0 を下回らないよう制限する（`Z`） */
  zeroLimit?: boolean;
  /** リソースを 0〜最大値の範囲に収める（`L`） */
  rangeLimit?: boolean;
  /** 現在値を最大値で満たす。他オプションと排他。 */
  fillToMax?: boolean;
}

/**
 * リソース操作コマンドの文法。組み立て（make）と解釈（parse）を一箇所に置く。
 *
 * コマンドはチャットを経由して ResourceCommandHandler が実行するため、
 * 発言を組み立てる UI と実行する側は互いを知らない。両者が共有するのはこの文法だけ。
 */
export namespace ResourceCommand {
  const commandRegToken: RegExp = /t?:[^\+\-\=\>:\s]+[\+\-\=\>][^:\s]+/ig;
  const commandRegParts: RegExp = /^(t?):([^\+\-\=\>:\s]+)([\+\-\=\>])([^:\s]+)/i;

  /**
   * リソース名として使えない文字。
   * - `+ - = >` は演算子で、そこからコマンド本体が始まる
   * - `:` はリソース名の開始記号
   * - `^` は最大値操作の指定（isMaxValue で扱う）
   * - 空白は発言をコマンドへ分割する区切り
   */
  const INVALID_RESOURCE_NAME_PATTERN = /[+\-=>:^\s]/;

  export function isValidResourceName(name: string): boolean {
    let trimmed = name != null ? name.trim() : '';
    if (trimmed.length < 1) return false;
    return !INVALID_RESOURCE_NAME_PATTERN.test(trimmed);
  }

  /** 型なしタグの値を、増減しても壊れない数値と見なせるか。 */
  const NUMERIC_VALUE_PATTERN = /^\s*[+-]?\d+\s*$/;

  /** 増減の対象にできるタグか。 */
  export function isOperableTarget(tag: DataElement): boolean {
    if (tag == null) return false;
    return tag.isNumberResource || (tag.type == null && NUMERIC_VALUE_PATTERN.test(String(tag.value)));
  }

  /** UI上、現在値と最大値でリソース名を共有するので、ひとつの文字列キーにまとめる。 */
  export function makeResourceKey(name: string, isMaxValue: boolean): string {
    return name + (isMaxValue ? '^' : '');
  }

  /** `HP^` を `{ name: 'HP', isMaxValue: true }` へ分解する */
  export function parseResourceKey(key: string): { name: string, isMaxValue: boolean } {
    let isMaxValue = key != null && key.endsWith('^');
    return { name: isMaxValue ? key.slice(0, -1) : (key ?? ''), isMaxValue: isMaxValue };
  }

  /** 選択中のリソースをコマ切り替え後も残すか。 */
  export function pruneResourceKey(key: string, currentOptions: DataElement[], maxOptions: DataElement[]): string {
    if (!key) return '';
    let { name, isMaxValue } = parseResourceKey(key);
    let trimmed = name.trim();
    let available = isMaxValue ? maxOptions : currentOptions;
    return available.some(tag => tag.name.trim() === trimmed) ? key : '';
  }

  /**
   * タグの並びを、コマンドの対象にできる要素へ展開する。
   * 「バフ・デバフ」のように配下へリソースをぶら下げただけのタグは、配下を候補として並べる。
   */
  export function expandTargets(tags: DataElement[]): DataElement[] {
    let targets: DataElement[] = [];
    for (let tag of tags) {
      if (tag == null) continue;
      if (tag.isNumberResource) {
        targets.push(tag);
        continue;
      }
      let resources = tag.getElementsByType('numberResource');
      // リソースを持たないタグは残す
      Array.prototype.push.apply(targets, 0 < resources.length ? resources : [tag]);
    }
    return targets;
  }

  /** `:HP+5ZL` / `t:HP^-3Z` を組み立てる。解釈できない指定なら null */
  export function make(options: ResourceCommandOptions): string | null {
    let name = options.resourceName != null ? options.resourceName.trim() : '';
    if (!isValidResourceName(name)) return null;

    // コマンドの接頭と参照記法の接頭は同じ `t`。ターゲット参照を含む発言は
    // palette-message がターゲットごとに1通へ分ける
    let scope = options.isTargetMode ? 't' : '';

    if (options.fillToMax) {
      // 最大値を最大値で満たす指定は意味を成さない
      if (options.isMaxValue) return null;
      return scope + ':' + name + '=' + scope + '{' + name + '^}';
    }

    // 小数を渡すと解釈側が数式と見なさず文字列として扱ってしまう
    if (!Number.isInteger(options.value)) return null;

    return scope + ':'
      + makeResourceKey(name, options.isMaxValue)
      + (0 <= options.value ? '+' : '')
      + options.value.toString()
      + (options.zeroLimit ? 'Z' : '')
      + (options.rangeLimit ? 'L' : '');
  }

  /**
   * ターゲットに紐付かないリソース操作を取り除く。`t:` 付きだけが残る。
   *
   * ターゲットごとに1通ずつ発言を分ける場合、2通目以降でこれを通さないと
   * 自分向けの操作がターゲット数ぶん適用される。
   */
  export function stripNonTargetCommands(text: string): string {
    return CommandToken.strip(text, commandRegToken, command => isTargetCommand(command));
  }

  /** 半角化されたコマンド文字列が `t:` 付きか */
  function isTargetCommand(command: string): boolean {
    return /^t/i.test(command);
  }

  /**
   * 発言からリソース操作コマンドを抽出する。
   * @returns [自分向け, ターゲット向け]
   */
  export function parse(text: string): [ResourceCommand[], ResourceCommand[]] {
    let selfResourceCommands: ResourceCommand[] = [];
    let targetResourceCommands: ResourceCommand[] = [];

    let commands: string[] = StringUtil.toHalfWidth(text).match(commandRegToken) ?? [];

    for (let c of commands) {
      let res = c.match(commandRegParts);
      let isTargeting = /^t$/i.test(res[1]);
      let { name: resource, isMaxValue: optionMax } = parseResourceKey(res[2]);
      let operator = res[3];
      let command = res[4];

      let optionL = /LZ?$/i.test(command);
      let optionZ = /ZL?$/i.test(command);

      if (optionL || optionZ) command = command.replace(/(L?Z|Z?L)$/i, '');

      // 数式・ダイス式のみで構成されているか。BCDice へ渡す整形は実行側が行う
      let isCalculate: boolean = !/[^d\d\(\)\+\-\*\/]/.test(command);

      (isTargeting ? targetResourceCommands : selfResourceCommands).push({
        resource: resource,
        operator: operator,
        command: command,
        isCalculate: isCalculate,
        enableOptionL: optionL,
        enableOptionZ: optionZ,
        enableOptionMax: optionMax,
      });
    }
    return [selfResourceCommands, targetResourceCommands];
  }
}
