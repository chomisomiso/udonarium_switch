import { GameObject } from '../core/synchronize-object/game-object';
import { GameCharacter } from '../game-character';
import { YtsheetMultiPartImporter } from './ytsheet-multi-part-importer';

/**
 * XML から読み込んだオブジェクトに変換をかける。
 */
export namespace ImportConverter {
  export function convert(gameObject: GameObject): void {
    if (gameObject instanceof GameCharacter) YtsheetMultiPartImporter.convert(gameObject);
  }
}
