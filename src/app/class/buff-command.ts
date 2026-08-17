import { CommandToken } from './command-token';
import { StringUtil } from './core/system/util/string-util';
import { ResourceCommand } from './resource-command';

export type BuffCommandTarget = 'self' | 'target' | 'all';

export interface BuffInfo {
  buffName: string;
  buffEffect: string;
  expire: number | null;
}

/** ひとつの対象に対して実行するバフ操作のまとまり */
export interface BuffCommand {
  addBuffs: BuffInfo[];
  removeBuffNames: string[];
  changeAllRounds: number;
  removeExpired: boolean;
}

export interface BuffAddOptions {
  name: string;
  /** 効果ラウンド数。null / undefined / NaN なら無制限 */
  round?: number | null;
  effect?: string;
  target?: BuffCommandTarget;
}

/**
 * バフ操作コマンドの文法。組み立て（make 系）と解釈（parse）を一箇所に置く。
 *
 * コマンドはチャットを経由して BuffCommandHandler が実行するため、
 * 発言を組み立てる UI と実行する側は互いを知らない。両者が共有するのはこの文法だけ。
 */
export namespace BuffCommand {
  const commandRegAdd: RegExp = /^[ta]?&([^\/\s]+)(?:\/([^\/\s]+))?(?:\/([^\/\s]+))?/i;  // &バフ名/R数/効果 or &バフ名/効果/R数（後ろ2つは省略可能・順不同）
  const commandRegRemove: RegExp = /^[ta]?&([^\/\s]+)\-$/i;  // &バフ名-  指定バフを削除
  const commandRegDecreaseAll: RegExp = /^[ta]?&R\-$/i;    // &R- すべてのバフのラウンドを-1
  const commandRegIncreaseAll: RegExp = /^[ta]?&R\+$/i;    // &R+ すべてのバフのラウンドを+1
  const commandRegDeleteExpired: RegExp = /^[ta]?&D$/i;    // &D  0R以下のバフを消去
  const commandRegToken: RegExp = /[ta]?&[^&\s]+/ig;

  /**
   * バフ名として使えない文字。
   * - `/` は R 数・効果の区切り
   * - 空白は発言をコマンドへ分割する区切り
   * - `&` はコマンドそのものの区切り
   */
  const INVALID_NAME_PATTERN = /[\/\s&]/;

  export function prefix(target: BuffCommandTarget = 'self'): string {
    switch (target) {
      case 'all': return 'a&';
      case 'target': return 't&';
      default: return '&';
    }
  }

  /** 追加するバフの名前として妥当か */
  export function isValidName(name: string): boolean {
    let trimmed = name != null ? name.trim() : '';
    if (trimmed.length < 1) return false;
    if (INVALID_NAME_PATTERN.test(trimmed)) return false;
    // 末尾が `-` だと削除コマンドとして解釈されてしまう
    if (/-$/.test(trimmed)) return false;
    // `&D` は期限切れ削除コマンドと衝突する（半角化してから判定する）
    if (/^D$/i.test(StringUtil.toHalfWidth(trimmed))) return false;
    return true;
  }

  /** バフの効果として妥当か。解釈側は `/` 区切りを 2 つまでしか読まない */
  export function isValidEffect(effect: string): boolean {
    let trimmed = effect != null ? effect.trim() : '';
    if (trimmed.length < 1) return true;   // 効果は省略可
    return !INVALID_NAME_PATTERN.test(trimmed);
  }

  export function isInsertableEffectTarget(name: string): boolean {
    let trimmed = name != null ? name.trim() : '';
    if (trimmed.length < 1) return false;
    if (!isValidEffect(trimmed)) return false;
    // addBuff 側は `,` もリソース名の区切りとして扱う
    if (/,/.test(trimmed)) return false;
    return ResourceCommand.isValidResourceName(trimmed);
  }

  /** 削除対象のバフ名として妥当か */
  export function isValidRemoveName(name: string): boolean {
    let trimmed = name != null ? name.trim() : '';
    if (trimmed.length < 1) return false;
    if (INVALID_NAME_PATTERN.test(trimmed)) return false;
    // `&R-` は全バフのラウンド減少コマンドと衝突する
    if (/^R$/i.test(StringUtil.toHalfWidth(trimmed))) return false;
    return true;
  }

  /** `&名前/R数/効果` を組み立てる。解釈できない指定なら null */
  export function makeAdd(options: BuffAddOptions): string | null {
    let name = options.name != null ? options.name.trim() : '';
    let effect = options.effect != null ? options.effect.trim() : '';
    if (!isValidName(name) || !isValidEffect(effect)) return null;

    let parts: string[] = [];
    let round = options.round;
    if (round != null && !Number.isNaN(round)) {
      // 解釈側は /^\d+$/ でしか R 数を認識しない
      if (!Number.isInteger(round) || round < 0) return null;
      parts.push(round.toString());
    }
    if (0 < effect.length) parts.push(effect);

    return prefix(options.target) + name + (0 < parts.length ? '/' + parts.join('/') : '');
  }

  /** `&名前-` を組み立てる */
  export function makeRemove(name: string, target: BuffCommandTarget = 'self'): string | null {
    let trimmed = name != null ? name.trim() : '';
    if (!isValidRemoveName(trimmed)) return null;
    return prefix(target) + trimmed + '-';
  }

  /** `&R-` / `&R+` を組み立てる。delta は符号だけを見る */
  export function makeChangeRound(delta: number, target: BuffCommandTarget = 'self'): string | null {
    if (!delta) return null;
    return prefix(target) + 'R' + (delta < 0 ? '-' : '+');
  }

  /** `&D` を組み立てる */
  export function makeRemoveExpired(target: BuffCommandTarget = 'self'): string {
    return prefix(target) + 'D';
  }

  /** ラウンドを 1 進めて期限切れを掃除する。`&R- &D` の並び */
  export function makeProgressRound(target: BuffCommandTarget = 'self'): string {
    return `${makeChangeRound(-1, target)} ${makeRemoveExpired(target)}`;
  }

  /**
   * ターゲットに紐付かないバフ操作を取り除く。`t&` 付きだけが残る。
   *
   * 効いている区別は「発言1通につき1回適用されるか（self・all）」と
   * 「ターゲットごとに1回適用されるか（target）」。全体向けは targetIds を見ずに
   * テーブル上の全員へ適用されるので、前者として落とす必要がある。
   */
  export function stripNonTargetCommands(text: string): string {
    return CommandToken.strip(text, commandRegToken, command => scopeOf(command) === 'target');
  }

  /** 半角化されたコマンド文字列から、接頭辞が指す対象を読む */
  function scopeOf(command: string): BuffCommandTarget {
    if (/^a/i.test(command)) return 'all';
    if (/^t/i.test(command)) return 'target';
    return 'self';
  }

  /**
   * 発言からバフ操作コマンドを抽出する。
   * @returns [自分向け, ターゲット向け, 全体向け]。該当するコマンドが無い対象は null
   */
  export function parse(text: string): [BuffCommand | null, BuffCommand | null, BuffCommand | null] {
    let selfBuffCommand: BuffCommand | null = null;
    let targetBuffCommand: BuffCommand | null = null;
    let allBuffCommand: BuffCommand | null = null;

    let commands: string[] = StringUtil.toHalfWidth(text).match(commandRegToken) ?? [];

    for (let c of commands) {
      let commandTarget: BuffCommand;
      let scope = scopeOf(c);
      if (scope === 'all') {
        if (!allBuffCommand) allBuffCommand = emptyCommand();
        commandTarget = allBuffCommand;
      } else if (scope === 'target') {
        if (!targetBuffCommand) targetBuffCommand = emptyCommand();
        commandTarget = targetBuffCommand;
      } else {
        if (!selfBuffCommand) selfBuffCommand = emptyCommand();
        commandTarget = selfBuffCommand;
      }

      if (commandRegDecreaseAll.test(c)) {
        commandTarget.changeAllRounds -= 1;
      } else if (commandRegIncreaseAll.test(c)) {
        commandTarget.changeAllRounds += 1;
      } else if (commandRegDeleteExpired.test(c)) {
        commandTarget.removeExpired = true;
      } else if (commandRegRemove.test(c)) {
        commandTarget.removeBuffNames.push(c.match(commandRegRemove)[1]);
      } else if (commandRegAdd.test(c)) {
        commandTarget.addBuffs.push(parseAddCommand(c));
      } else {
        continue;
      }
    }
    return [selfBuffCommand, targetBuffCommand, allBuffCommand];
  }

  function emptyCommand(): BuffCommand {
    return { addBuffs: [], removeBuffNames: [], changeAllRounds: 0, removeExpired: false };
  }

  function parseAddCommand(command: string): BuffInfo {
    let res = command.match(commandRegAdd);
    let buffName = res[1];
    let part1 = res[2] || '';
    let part2 = res[3] || '';

    // 数値のみの部分をR数、それ以外を効果として振り分ける（両方数値なら先がR数）
    if (/^\d+$/.test(part1)) return { buffName: buffName, buffEffect: part2, expire: parseInt(part1) };
    if (/^\d+$/.test(part2)) return { buffName: buffName, buffEffect: part1, expire: parseInt(part2) };
    return { buffName: buffName, buffEffect: part1, expire: null };
  }
}
