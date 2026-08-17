export enum CompareOption {
  None = 0,
  IgnoreCase = 1,
  IgnoreWidth = 2,
}

export namespace StringUtil {
  const HTML_ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '\'': '&#x27;',
    '`': '&#x60;',
    '"': '&quot;',
    '<': '&lt;',
    '>': '&gt;',
  };

  export function toHalfWidth(str: string): string {
    return str.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  }

  export function escapeHtml(str: string): string {
    return str.replace(/[&'`"<>]/g, match => HTML_ESCAPE_MAP[match]);
  }

  /**
   * ハーメルン記法のルビ（|ルビ対象《ルビ》）を <ruby> 要素に変換する。
   * タグを生成するため、必ず escapeHtml() を通した文字列を渡すこと。
   * escapeHtml() は | ｜ 《 》 を変換しないので、この順序でマッチングは成立する。
   */
  export function rubyToHtml(str: string): string {
    return str.replace(/[\|｜]([^\|｜\s]+?)《(.+?)》/g, '<ruby>$1<rp>(</rp><rt>$2</rt><rp>)</rp></ruby>');
  }

  export function equals(str1: string, str2: string, option: CompareOption = CompareOption.None): boolean {
    return str1.length === str2.length && (str1 === str2 || normalize(str1, option) === normalize(str2, option));
  }

  export function normalize(str: string, option: CompareOption): string {
    if (option === CompareOption.None) return str;
    let normalize = str;

    if (option & CompareOption.IgnoreCase) normalize = normalize.toLocaleLowerCase();
    if (option & CompareOption.IgnoreWidth) normalize = toHalfWidth(normalize);

    return normalize;
  }
}
