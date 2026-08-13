import { StringUtil } from './core/system/util/string-util';

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

  /** `:HP+5ZL` / `t:HP^-3Z` を組み立てる。解釈できない指定なら null */
  export function make(options: ResourceCommandOptions): string | null {
    let name = options.resourceName != null ? options.resourceName.trim() : '';
    if (!isValidResourceName(name)) return null;
    // 小数を渡すと解釈側が数式と見なさず文字列として扱ってしまう
    if (!Number.isInteger(options.value)) return null;

    return (options.isTargetMode ? 't:' : ':')
      + name
      + (options.isMaxValue ? '^' : '')
      + (0 <= options.value ? '+' : '')
      + options.value.toString()
      + (options.zeroLimit ? 'Z' : '')
      + (options.rangeLimit ? 'L' : '');
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
      let resource = res[2];
      let operator = res[3];
      let command = res[4];

      let optionL = /LZ?$/i.test(command);
      let optionZ = /ZL?$/i.test(command);
      let optionMax = /\^$/.test(resource);

      if (optionL || optionZ) command = command.replace(/(L?Z|Z?L)$/i, '');
      if (optionMax) resource = resource.replace(/\^$/, '');

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
