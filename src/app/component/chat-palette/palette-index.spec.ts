import { parsePaletteIndex } from 'component/chat-palette/palette-index';

describe('parsePaletteIndex', () => {
  /** 名前と行番号だけ見たいとき用 */
  function namesAndLines(lines: string[]) {
    return parsePaletteIndex(lines).map(entry => [entry.name, entry.line]);
  }

  describe('書式の判定', () => {
    it('3種の書式を拾う', () => {
      expect(namesAndLines([
        '### 見出しA',
        '//---見出しB',
        '◆見出しC',
      ])).toEqual([
        ['見出しA', 0],
        ['見出しB', 1],
        ['◆見出しC', 2],
      ]);
    });

    it('行番号は渡した配列のインデックスと一致する', () => {
      expect(namesAndLines([
        '2d+7+3 冒険者：器用',
        '',
        '### 見出し',
        'k36[(8+{C修正})]+11 ダメージ',
        '◆ 次の見出し',
      ])).toEqual([
        ['見出し', 2],
        ['◆ 次の見出し', 4],
      ]);
    });

    it('全角スラッシュの // も書式として認める', () => {
      expect(namesAndLines(['／／---見出し'])).toEqual([['見出し', 0]]);
    });

    it('見出しでない行は拾わない', () => {
      expect(parsePaletteIndex([
        '2d+7+3 冒険者：器用',
        'k36[(8+{C修正})]+11+{追加D修正} ダメージ',
        '&『必殺攻撃■』/必殺効果+1,回避修正-1/1',
        '[宣]『必殺攻撃■』',
        'ダメージ:HP-()',
        '回復:HP+()L',
        '//出目修正=$+{クリレイ}#{必殺効果}',
      ]).length).toBe(0);
    });
  });

  describe('行頭の空白', () => {
    it('半角空白・タブでインデントされていても拾う', () => {
      expect(namesAndLines([
        '  ### 見出しA',
        '\t//---見出しB',
        '   ◆見出しC',
      ])).toEqual([
        ['見出しA', 0],
        ['見出しB', 1],
        ['◆見出しC', 2],
      ]);
    });

    it('全角空白でインデントされていても拾う', () => {
      expect(namesAndLines(['　　### 見出し'])).toEqual([['見出し', 0]]);
    });

    it('CRLF 由来の行末 \\r を名前に残さない', () => {
      expect(namesAndLines('### 見出し\r\n◆ 次\r\n'.split('\n'))).toEqual([
        ['見出し', 0],
        ['◆ 次', 1],
      ]);
    });

    it('インデントの量は深さに影響しない', () => {
      expect(parsePaletteIndex([
        '### 見出しA',
        '        ### 見出しB',
      ]).map(entry => entry.depth)).toEqual([0, 0]);
    });
  });

  describe('表示名', () => {
    it('接頭記号と続く空白だけを剥がし、◆ は名前に残す', () => {
      expect(namesAndLines([
        '### ◆ 非戦闘系・魔物知識・受身',
        '//--- ◆ 武器攻撃系',
      ])).toEqual([
        ['◆ 非戦闘系・魔物知識・受身', 0],
        ['◆ 武器攻撃系', 1],
      ]);
    });

    it('記号と名前の間に空白がなくてもよい', () => {
      expect(namesAndLines(['###見出し', '//---見出し'])).toEqual([
        ['見出し', 0],
        ['見出し', 1],
      ]);
    });

    it('名前の途中の空白は残す', () => {
      expect(namesAndLines(['### 見 出 し'])).toEqual([['見 出 し', 0]]);
    });
  });

  describe('深さ', () => {
    it('文書内の最小記号数を 0 段目にする', () => {
      expect(parsePaletteIndex([
        '### 見出しA',
        '### 見出しB',
        '#### 子B1',
        '#### 子B2',
        '### 見出しC',
      ]).map(entry => entry.depth)).toEqual([0, 0, 1, 1, 0]);
    });

    it('記号の数をそのまま深さにはしない', () => {
      expect(parsePaletteIndex(['##### 見出し']).map(entry => entry.depth)).toEqual([0]);
    });

    it('//--- も同じ数え方で階層になる', () => {
      expect(parsePaletteIndex([
        '//--見出しA',
        '//---子A1',
        '//----孫A1a',
      ]).map(entry => entry.depth)).toEqual([0, 1, 2]);
    });

    it('深さは書式ごとに独立して数える', () => {
      expect(parsePaletteIndex([
        '#### 見出しA',
        '//-- 見出しB',
        '◆ 見出しC',
      ]).map(entry => entry.depth)).toEqual([0, 0, 0]);
    });

    it('◆ は常に最上位', () => {
      expect(parsePaletteIndex([
        '◆ 見出しA',
        '◆ 見出しB',
      ]).map(entry => entry.depth)).toEqual([0, 0]);
    });
  });

  describe('変数行', () => {
    it('ChatPalette が変数として読む行は索引にしない', () => {
      expect(parsePaletteIndex([
        '//威力={威力度}',
        '//器用B=(({器用}+{器用増強})/6)',
        '//LV = {冒険者}',
      ]).length).toBe(0);
    });

    it('- で始まる名前の変数を見出しと取り違えない', () => {
      expect(parsePaletteIndex(['//-x=1', '//---y＝2']).length).toBe(0);
    });

    it('= を含まない // 行は変数ではないので見出しになれる', () => {
      expect(namesAndLines(['//---見出し'])).toEqual([['見出し', 0]]);
    });
  });

  describe('境界', () => {
    it('空配列は空を返す', () => {
      expect(parsePaletteIndex([])).toEqual([]);
    });

    it('記号だけの行は索引にしない', () => {
      expect(parsePaletteIndex([
        '#',
        '##',
        '###   ',
        '//-',
        '//---',
        '//--- ',
        '◆',
        '◆ ',
        '',
        '   ',
      ]).length).toBe(0);
    });
  });
});
