/** ダブルクリックと見なす間隔 */
const DOUBLE_PRESS_INTERVAL_MS = 400;

/**
 * 同じ項目を続けて押したかを判定する。
 *
 * `<select>` は click より先に input（選択の変更）が飛ぶため、判定を「今の選択」と
 * 突き合わせると、別の行を1回ずつ押しただけでもダブルクリックと見なしてしまう。
 * 判定は必ず「タイマーを張ったときの項目」と比べる。
 *
 * ネイティブの `dblclick` なら選択確定後に発火するのでこの罠自体が無いが、
 * タブレットでの double-tap は挙動が不安定でズームとも競合するため採らない。
 * `ResettableTimeout` も内部で `performance.now()` を見るので、
 * `jasmine.clock()` で時間を進める spec が書けず使えない。
 * テーブル上のコマの二度押しは `game-table/object-interact-gesture.ts` が別に持つ
 * （あちらは要素単位で、項目ごとの識別が要らない）。
 *
 * 置き場は最初の利用者に付いているだけで、パレット固有の知識は無い。
 * 3人目の利用者が出たら `class/` 側の中立な場所へ移すこと
 */
export class DoublePressDetector {
  private timer: ReturnType<typeof setTimeout> = null;
  private armedKey: string | number = null;

  /** 続けて2回目なら true。1回目なら false を返してタイマーを張る */
  press(key: string | number): boolean {
    // 別項目に張り替えるときも、古いタイマーを必ず解いてから進む。
    // 残すと後から発火して、張り直したばかりの項目を解いてしまう
    let isDouble = this.timer != null && this.armedKey === key;
    this.cancel();
    if (isDouble) return true;

    this.armedKey = key;
    this.timer = setTimeout(() => this.cancel(), DOUBLE_PRESS_INTERVAL_MS);
    return false;
  }

  /**
   * 張ったタイマーを解く。
   * 破棄時に呼ぶのはリーク対策ではなく（クロージャが掴むのはこのオブジェクトだけ）、
   * 破棄後に発火した setTimeout が無駄な変更検知を回すのを避けるため
   */
  cancel(): void {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
    this.armedKey = null;
  }
}
