/** ダブルクリックと見なす間隔 */
const DOUBLE_PRESS_INTERVAL_MS = 400;

/**
 * 同じ項目を続けて押したかを判定する。
 *
 * `<select>` は click より先に input（選択の変更）が飛ぶため、判定を「今の選択」と
 * 突き合わせると、別の行を1回ずつ押しただけでもダブルクリックと見なしてしまう。
 * 判定は必ず「タイマーを張ったときの項目」と比べる。
 *
 * ネイティブの `dblclick` は使わない。判定の間隔が OS 設定で決まって JS から読めないため、
 * 単押しの処理を「2回目が来なかったら」まで遅らせる用途（`onSingle`）と窓が揃わない。
 * また、タブレットでの double-tap は挙動が不安定で、ズームとも競合する。
 * `ResettableTimeout` も内部で `performance.now()` を見るので、
 * `jasmine.clock()` で時間を進める spec が書けず使えない。
 * テーブル上のコマの二度押しは `game-table/object-interact-gesture.ts` が別に持つ
 * （あちらは要素単位で、項目ごとの識別が要らない）。
 */
export class DoublePressDetector {
  private timer: ReturnType<typeof setTimeout> = null;
  private armedKey: string | number = null;

  constructor(private intervalMs: number = DOUBLE_PRESS_INTERVAL_MS) {}

  /**
   * 続けて2回目なら true。1回目なら false を返してタイマーを張る。
   * `onSingle` は、2回目が来ないまま間隔が過ぎたときだけ呼ぶ
   * （2回目の成立・別項目への張り替え・`cancel()` では呼ばない）
   */
  press(key: string | number, onSingle?: () => void): boolean {
    // 別項目に張り替えるときも、古いタイマーを必ず解いてから進む。
    // 残すと後から発火して、張り直したばかりの項目を解いてしまう
    let isDouble = this.timer != null && this.armedKey === key;
    this.cancel();
    if (isDouble) return true;

    this.armedKey = key;
    this.timer = setTimeout(() => {
      this.cancel();
      if (onSingle) onSingle();
    }, this.intervalMs);
    return false;
  }

  /**
   * 張ったタイマーを解く。
   * 破棄時に呼ぶのは、破棄後に発火した setTimeout が無駄な変更検知を回すのを避けるため。
   * `onSingle` を渡している利用者は、破棄後に単押しの処理が走らないよう必ず呼ぶこと
   */
  cancel(): void {
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
    this.armedKey = null;
  }
}
