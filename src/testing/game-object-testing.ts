import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';

/**
 * GameObject を扱うテストの後始末。`afterEach(resetGameObjects)` で使う。
 *
 * ObjectStore と EventSystem は Angular DI の外のシングルトンで、Karma では
 * 全 spec が同一バンドル・同一プロセスで動くため、明示的に片付けないと状態が次のテストへ漏れる。
 *
 * 注意点:
 * - EventSystem.unregister(null) は引数 1 個の形で呼ぶと全リスナーを一括解除する。
 *   ネットワークコールバック（initializeNetworkEvent）は Listener ではなく
 *   Network.callback への代入なので、これでは消えない（消してはいけない）。
 * - ObjectStore.delete() ではなく remove() を使う。delete() は garbageMap に墓標を残し、
 *   同じ identifier での add() が以後ずっと null を返すようになる。
 * - ObjectFactory は絶対にリセットしないこと。@SyncObject の登録は各モジュールの
 *   import 時に一度きり実行され、単一バンドル内では二度と走らないため、
 *   潰すと ObjectFactory.create() が全クラスを構築できなくなる。
 */
export function resetGameObjects(): void {
  EventSystem.unregister(null);
  for (let object of ObjectStore.instance.getObjects()) {
    ObjectStore.instance.remove(object);
  }
  ObjectStore.instance.clearDeleteHistory();
}

/**
 * 保留中のマイクロタスクを流す。
 *
 * GameObject の変更通知（object-event-extension の markForChanged）は queueMicrotask で
 * バッチ処理されるため、イベントを観測するテストでは書き換えの後にこれを await する。
 * なお EventSystem.call() は Network のループバック（MessageChannel 経由）を通るので
 * マイクロタスクでは流れない。同期的に発火させたいテストでは trigger() を直接使うこと。
 */
export function flushMicrotasks(): Promise<void> {
  return Promise.resolve();
}
