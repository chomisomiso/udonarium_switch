import { CommandToken } from '@udonarium/command-token';

describe('CommandToken', () => {
  // ResourceCommand の文法を借りた検証用。機構だけを見るので文法自体は問わない。
  // strip は空白を跨がない正規表現を前提とするので、文字クラスの \s は外さないこと
  const COMMAND = /t?:[^\+\-\=\>:\s]+[\+\-\=\>][^:\s]+/ig;

  /** t 接頭辞付きだけを残す */
  function strip(text: string): string {
    return CommandToken.strip(text, COMMAND, command => /^t/i.test(command));
  }

  it('残す指定のコマンドだけが残る', () => {
    expect(strip('t:HP-5 :MP+1')).toBe('t:HP-5');
  });

  // 空白なしで並んだコマンドを個別に判定できること。これができないと巻き添えで消える
  it('空白なしで隣接していても個別に削る', () => {
    expect(strip('t:HP-5:MP+1')).toBe('t:HP-5');
  });

  it('コマンドでないトークンはそのまま残る', () => {
    expect(strip('2d6+3 斬りつけた :HP-1')).toBe('2d6+3 斬りつけた');
  });

  // 文法が空白を跨ぐと、先行コマンドの値が後続のコマンドを飲み込んで判定が壊れる。
  // 削る側が先に来るこの並びでしか露見しないので、文字クラスの \s を守る回帰テスト
  it('削る側のコマンドが先にあっても後続を巻き込まない', () => {
    expect(strip(':MP+1 t:HP-5')).toBe('t:HP-5');
  });

  // 正規化したコピーで位置を取り、元テキストから削るので、残す側の文字は変換されない
  it('残す部分の全角は変換されない', () => {
    expect(strip('全角のまま　ｔ：ＨＰ－５')).toBe('全角のまま ｔ：ＨＰ－５');
  });

  it('全角で書かれたコマンドも判定できる', () => {
    expect(strip('ｔ：ＨＰ－５ ：ＭＰ＋１')).toBe('ｔ：ＨＰ－５');
  });

  it('全部削れば空文字', () => {
    expect(strip(':HP-5 :MP+1')).toBe('');
  });

  it('前後や連続の空白で壊れない', () => {
    expect(strip('  t:HP-5   :MP+1  ')).toBe('t:HP-5');
  });

  it('空文字を渡しても壊れない', () => {
    expect(strip('')).toBe('');
  });

  // g フラグ付きの正規表現を使い回すので、lastIndex が残ると2回目以降がずれる
  it('同じ正規表現を続けて使っても結果が変わらない', () => {
    expect(strip('t:HP-5 :MP+1')).toBe('t:HP-5');
    expect(strip('t:HP-5 :MP+1')).toBe('t:HP-5');
    expect(strip('t:HP-5 :MP+1')).toBe('t:HP-5');
  });
});
