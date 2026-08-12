import { ContextMenuAction, ContextMenuService } from 'service/context-menu.service';
import { PointerDeviceService } from 'service/pointer-device.service';

/** 索引の書式。深さは同じ種別の中での相対値なので、種別を持ち回る */
type IndexMarkerKind = 'hash' | 'dash' | 'diamond';

export interface PaletteIndexEntry {
  /** 一覧に出す名前。接頭記号を落として trim 済み */
  name: string;
  /** 索引が指す行のインデックス(0 始まり) */
  line: number;
  /** 見出しの深さ。0 が最上位 */
  depth: number;
}

interface IndexMatch extends PaletteIndexEntry {
  kind: IndexMarkerKind;
  /** 記号の個数。文書内の最小値を 0 に均して depth にする */
  rank: number;
}

const VARIABLE_LINE_REGEXP = /^\s*[/／]{2}[^=＝{}｛｝\s]+\s*[=＝]/;
const HASH_HEADER_REGEXP = /^\s*(#+)\s*([^#\s].*?)\s*$/;
const DASH_HEADER_REGEXP = /^\s*[/／]{2}(-+)\s*([^-\s].*?)\s*$/;
const DIAMOND_HEADER_REGEXP = /^\s*(◆\s*\S.*?)\s*$/;

/** パレットの行から見出しを拾う。行頭の空白は書式の一部として許容する */
export function parsePaletteIndex(lines: string[]): PaletteIndexEntry[] {
  let matches: IndexMatch[] = [];
  lines.forEach((line, index) => {
    let match = matchIndexHeader(line, index);
    if (match) matches.push(match);
  });

  // 深さは絶対値ではなく文書内の相対値。種別ごとの最小記号数を 0 段目にする
  let baseRanks = new Map<IndexMarkerKind, number>();
  for (let match of matches) {
    let base = baseRanks.get(match.kind);
    if (base == null || match.rank < base) baseRanks.set(match.kind, match.rank);
  }

  return matches.map(match => ({
    name: match.name,
    line: match.line,
    depth: match.rank - (baseRanks.get(match.kind) ?? match.rank),
  }));
}

function matchIndexHeader(line: string, index: number): IndexMatch | null {
  if (VARIABLE_LINE_REGEXP.test(line)) return null;

  let hash = HASH_HEADER_REGEXP.exec(line);
  if (hash) return { kind: 'hash', rank: hash[1].length, name: hash[2], line: index, depth: 0 };

  let dash = DASH_HEADER_REGEXP.exec(line);
  if (dash) return { kind: 'dash', rank: dash[1].length, name: dash[2], line: index, depth: 0 };

  let diamond = DIAMOND_HEADER_REGEXP.exec(line);
  if (diamond) return { kind: 'diamond', rank: 1, name: diamond[1], line: index, depth: 0 };

  return null;
}

export interface PaletteIndexMenuDeps {
  contextMenuService: ContextMenuService;
  pointerDeviceService: PointerDeviceService;
}

/** 階層の字下げ。コンテキストメニューは white-space: nowrap なので半角空白では潰れる */
const INDENT = '　';
const MAX_INDENT_DEPTH = 4;

/**
 * パレットの索引一覧を開く。項目を選ぶと onJump にその見出しの行番号が渡る。
 */
export function openPaletteIndexMenu(
  deps: PaletteIndexMenuDeps,
  lines: string[],
  onJump: (line: number) => void
): void {
  let entries = parsePaletteIndex(lines);
  let actions: ContextMenuAction[] = 0 < entries.length
    ? entries.map(entry => ({
      name: INDENT.repeat(Math.min(entry.depth, MAX_INDENT_DEPTH)) + entry.name,
      action: () => onJump(entry.line),
    }))
    : [{ name: '索引が見つかりません', action: () => { } }];

  deps.contextMenuService.open(deps.pointerDeviceService.pointers[0], actions, 'ジャンプ');
}
