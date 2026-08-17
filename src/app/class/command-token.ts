import { StringUtil } from './core/system/util/string-util';

/**
 * 発言に埋め込まれたコマンドを、文法を知らずに走査するための道具。
 *
 * 何がコマンドかは各コマンド文法（`ResourceCommand` / `BuffCommand`）が正規表現で決める。
 * ここが持つのは「元の文字を保ったまま削る」機構だけ。
 * 渡す正規表現は空白を跨がないこと（跨ぐと後続のコマンドを巻き込む）。
 */
export namespace CommandToken {
  /**
   * `keep` が false を返したコマンドを取り除く。
   *
   * @param commandReg コマンド1つに一致する g フラグ付きの正規表現
   * @param keep 半角化されたコマンド文字列を受け、残すなら true
   */
  export function strip(text: string, commandReg: RegExp, keep: (command: string) => boolean): string {
    // toHalfWidth は文字位置を保つ 1:1 変換。正規化した側で位置を取り、元テキストから削る。
    // こうすると残す側の全角が変換されずに済む
    let normalized = StringUtil.toHalfWidth(text);
    let kept = '';
    let index = 0;
    for (let match of normalized.matchAll(commandReg)) {
      if (keep(match[0])) continue;
      kept += text.slice(index, match.index);
      index = match.index + match[0].length;
    }
    kept += text.slice(index);

    // 削った跡に残る空白を畳む
    return kept.trim().replace(/\s+/g, ' ');
  }
}
