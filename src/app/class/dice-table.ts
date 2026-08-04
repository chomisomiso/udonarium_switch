import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { ObjectNode } from './core/synchronize-object/object-node';
import { StringUtil } from './core/system/util/string-util';

interface DiceTableRow {
  min: number;
  max: number;
  text: string;
}

/**
 * チャットのコマンドで引くダイス表。
 * 表本体（`1:結果` の複数行テキスト）は ObjectNode.value に持つ。
 */
@SyncObject('dice-table')
export class DiceTable extends ObjectNode {
  @SyncVar() name: string = 'ダイス表';
  @SyncVar() command: string = '';
  @SyncVar() dice: string = '2d6';
  // 表のダイスは素の式で書くのが基本なのでゲームシステム指定なしを既定にする
  @SyncVar() dicebot: string = 'DiceBot';

  get text(): string { return <string>this.value; }
  set text(text: string) { this.value = text; }

  /** 出目に対応する行の本文を返す。該当する行が無ければ null */
  lookup(value: number): string | null {
    let row = this.parseRows().find(row => row.min <= value && value <= row.max);
    return row ? row.text : null;
  }

  /**
   * 表テキストを1行ずつ解釈する。行頭が数字でない行（見出しやコメント）は読み飛ばす。
   */
  private parseRows(): DiceTableRow[] {
    let rows: DiceTableRow[] = [];
    for (let line of this.text.split('\n')) {
      let array = /^\s*([^:：,，\s]+)[:：,，\s]\s*(.*)$/.exec(line);
      if (!array) continue;

      // 全角の －／～ は半角化済み。かな入力で紛れ込む ー や各種ダッシュも区切りとして許す
      let range = /^(\d*)([-−–—―ー〜~])?(\d*)$/.exec(StringUtil.toHalfWidth(array[1]));
      if (!range) continue;

      let [, lower, separator, upper] = range;
      // 数字が無い行と、区切りだけの行は表の行として扱わない
      if (lower.length < 1 && (!separator || upper.length < 1)) continue;

      // 片側を省略すると上限／下限のない範囲になる
      let min: number = 0 < lower.length ? Number(lower) : -Infinity;
      let max: number = !separator ? min : (0 < upper.length ? Number(upper) : Infinity);
      rows.push({
        min: Math.min(min, max),
        max: Math.max(min, max),
        text: array[2].replace(/\\n/g, '\n'),
      });
    }
    return rows;
  }

  static create(): DiceTable {
    let diceTable: DiceTable = new DiceTable();
    diceTable.name = '新しいダイス表';
    diceTable.text = '';
    diceTable.initialize();
    return diceTable;
  }

  /** ルームに最初から置いておく記述例。 */
  static createSample(): DiceTable {
    let diceTable: DiceTable = new DiceTable('SampleDiceTable');
    diceTable.name = 'ダイス表サンプル';
    diceTable.command = 'SAMPLE';
    diceTable.dice = '2d6';
    diceTable.text = `ダイス表入力例：
2:凶
3:末吉
4-6:小吉
-9:中吉
~12:吉
13~:大吉`;
    diceTable.initialize();
    return diceTable;
  }
}
