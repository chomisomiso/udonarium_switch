import { CompareOption, StringUtil } from './string-util';

describe('StringUtil', () => {
  describe('toHalfWidth', () => {
    it('全角英数字を半角化する', () => {
      expect(StringUtil.toHalfWidth('ＡＢＣ')).toBe('ABC');
      expect(StringUtil.toHalfWidth('１２３')).toBe('123');
    });

    it('DiceTable が区切りに使う記号を半角化する', () => {
      expect(StringUtil.toHalfWidth('：')).toBe(':');
      expect(StringUtil.toHalfWidth('，')).toBe(',');
      expect(StringUtil.toHalfWidth('－')).toBe('-');
      expect(StringUtil.toHalfWidth('～')).toBe('~');
    });

    // 変換範囲は [！-～]（U+FF01〜U+FF5E）に限られる。
    // DiceTable の範囲パターンが 'ー' や '〜' を別途セパレータとして列挙しているのはこのため
    it('U+FF01〜U+FF5E の外側は変換しない', () => {
      expect(StringUtil.toHalfWidth('ー')).toBe('ー');   // U+30FC 長音符
      expect(StringUtil.toHalfWidth('〜')).toBe('〜');   // U+301C 波ダッシュ
      expect(StringUtil.toHalfWidth('、')).toBe('、');   // U+3001 読点
      expect(StringUtil.toHalfWidth('　')).toBe('　');   // U+3000 全角スペース
    });

    it('半角文字と日本語はそのまま通す', () => {
      expect(StringUtil.toHalfWidth('abc123')).toBe('abc123');
      expect(StringUtil.toHalfWidth('ダイス表')).toBe('ダイス表');
    });
  });

  describe('escapeHtml', () => {
    it('HTML 特殊文字 6 種をエスケープする', () => {
      expect(StringUtil.escapeHtml('&')).toBe('&amp;');
      expect(StringUtil.escapeHtml('\'')).toBe('&#x27;');
      expect(StringUtil.escapeHtml('`')).toBe('&#x60;');
      expect(StringUtil.escapeHtml('"')).toBe('&quot;');
      expect(StringUtil.escapeHtml('<')).toBe('&lt;');
      expect(StringUtil.escapeHtml('>')).toBe('&gt;');
    });

    it('タグを無害化する', () => {
      expect(StringUtil.escapeHtml('<script>alert("x")</script>'))
        .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    });

    it('エスケープ済みの文字列は二重エスケープされる', () => {
      expect(StringUtil.escapeHtml('&amp;')).toBe('&amp;amp;');
    });

    it('対象外の文字は変更しない', () => {
      expect(StringUtil.escapeHtml('ふつうの文｜《》')).toBe('ふつうの文｜《》');
    });
  });

  describe('rubyToHtml', () => {
    it('ハーメルン記法を ruby 要素に変換する', () => {
      expect(StringUtil.rubyToHtml('|漢字《かんじ》'))
        .toBe('<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>');
    });

    it('全角の｜も区切りとして扱う', () => {
      expect(StringUtil.rubyToHtml('｜漢字《かんじ》'))
        .toBe('<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>');
    });

    it('ルビ対象に空白が挟まると変換しない', () => {
      expect(StringUtil.rubyToHtml('| 漢字《かんじ》')).toBe('| 漢字《かんじ》');
    });

    it('記法に合致しない文字列はそのまま返す', () => {
      expect(StringUtil.rubyToHtml('漢字《かんじ》')).toBe('漢字《かんじ》');
      expect(StringUtil.rubyToHtml('|漢字')).toBe('|漢字');
    });

    // escapeHtml が | ｜ 《 》 を変換しないので、この順序でのみ合成が成立する。
    // 順序を逆にすると rubyToHtml が生成した <ruby> ごとエスケープされて壊れる
    it('escapeHtml の後段で動かしても記法が壊れず、タグも注入されない', () => {
      let actual = StringUtil.rubyToHtml(StringUtil.escapeHtml('|<b>《ルビ》'));

      expect(actual).toBe('<ruby>&lt;b&gt;<rp>(</rp><rt>ルビ</rt><rp>)</rp></ruby>');
      expect(actual).not.toContain('<b>');
    });
  });

  describe('normalize', () => {
    it('CompareOption.None は何もしない', () => {
      expect(StringUtil.normalize('ＡＢc', CompareOption.None)).toBe('ＡＢc');
    });

    it('IgnoreCase は小文字化する', () => {
      expect(StringUtil.normalize('ABC', CompareOption.IgnoreCase)).toBe('abc');
    });

    it('IgnoreWidth は半角化する', () => {
      expect(StringUtil.normalize('ＡＢＣ', CompareOption.IgnoreWidth)).toBe('ABC');
    });

    it('ビットフラグを組み合わせられる', () => {
      let option = CompareOption.IgnoreCase | CompareOption.IgnoreWidth;
      expect(StringUtil.normalize('ＡＢＣ', option)).toBe('abc');
    });
  });

  describe('equals', () => {
    it('既定では厳密比較', () => {
      expect(StringUtil.equals('abc', 'abc')).toBe(true);
      expect(StringUtil.equals('abc', 'ABC')).toBe(false);
    });

    it('IgnoreCase で大文字小文字を無視する', () => {
      expect(StringUtil.equals('abc', 'ABC', CompareOption.IgnoreCase)).toBe(true);
    });

    it('IgnoreWidth で全角半角を無視する', () => {
      expect(StringUtil.equals('ａｂｃ', 'abc', CompareOption.IgnoreWidth)).toBe(true);
    });

    it('フラグを組み合わせられる', () => {
      let option = CompareOption.IgnoreCase | CompareOption.IgnoreWidth;
      expect(StringUtil.equals('ＡＢＣ', 'abc', option)).toBe(true);
    });

    // 正規化の前に長さで短絡するため、文字数が変わる正規化は成立しない
    it('文字数が違えば正規化せずに false', () => {
      expect(StringUtil.equals('abc', 'abcd', CompareOption.IgnoreCase)).toBe(false);
    });
  });
});
