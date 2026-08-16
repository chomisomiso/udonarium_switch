import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { GameObject } from './core/synchronize-object/game-object';
import { InnerXml } from './core/synchronize-object/object-serializer';
import { ObjectStore } from './core/synchronize-object/object-store';

/** ルーム全体で共有するゲームシステム（ダイスボット）設定 */
@SyncObject('game-system-setting')
export class GameSystemSetting extends GameObject implements InnerXml {
  // リモート由来の同一 identifier インスタンスとのバッティングを避けるため、実体を ObjectStore が持つ
  static get instance(): GameSystemSetting {
    let object = ObjectStore.instance.get<GameSystemSetting>('GameSystemSetting');
    if (!object) {
      object = new GameSystemSetting('GameSystemSetting');
      object.initialize();
    }
    return object;
  }

  @SyncVar() gameType: string = 'SwordWorld2.5';

  innerXml(): string { return ''; }
  parseInnerXml(element: Element) {
    // XMLからの新規作成を許可せず、既存のオブジェクトを更新する
    let context = GameSystemSetting.instance.toContext();
    context.syncData = this.toContext().syncData;
    GameSystemSetting.instance.apply(context);
    GameSystemSetting.instance.update();

    this.destroy();
  }
}
