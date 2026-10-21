import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';
import { GameCharacter } from '@udonarium/game-character';
import { YtsheetMultiPartImporter } from '@udonarium/xml-import/ytsheet-multi-part-importer';

/**
 * ゆとシートが出力する多部位コマ例
 * 部位は `上半身:HP` / `下半身:HP` の名前と、`防護` の値（`上半身8／下半身6`）に埋め込まれている
 */
export const MULTI_PART_XML = `<?xml version="1.0" encoding="UTF-8"?>
<character location.name="table" location.x="0" location.y="0" posZ="0" rotate="0" roll="0">
  <data name="character">
    <data name="image">
      <data type="image" name="imageIdentifier"></data>
    </data>
    <data name="common">
      <data name="name">ヒブレイザン</data>
      <data name="size">1</data>
    </data>
    <data name="detail">
      <data name="リソース">
        <data type="numberResource" currentValue="50" name="上半身:HP">55</data>
        <data type="numberResource" currentValue="45" name="下半身:HP">45</data>
        <data name="防護">上半身8／下半身6</data>
        <data name="弱点">雷属性ダメージ+3点</data>
      </data>
      <data name="バフ・デバフ">
        <data type="numberResource" currentValue="0" name="生命抵抗修正">10</data>
        <data type="numberResource" currentValue="0" name="回避修正">10</data>
      </data>
      <data name="情報">
        <data type="note" name="特殊能力">●上半身
▶2回攻撃&amp;双撃</data>
        <data name="テスト">何かを記載</data>
      </data>
      <data name="戦利品">
        <data name="自動">魔動部品(300G/黒白A)</data>
        <data name="2~8">なし</data>
      </data>
    </data>
  </data>
  <chat-palette dicebot="SwordWorld2.5" paletteColor="">2d+9+{回避修正} 回避／上半身
2d+10+{回避修正} 回避／下半身</chat-palette>
</character>`;

/** 単部位コマ例 */
export const SINGLE_PART_XML = `<?xml version="1.0" encoding="UTF-8"?>
<character location.name="table" location.x="0" location.y="0" posZ="0" rotate="0" roll="0">
  <data name="character">
    <data name="image">
      <data type="image" name="imageIdentifier"></data>
    </data>
    <data name="common">
      <data name="name">シャザーレィの砲塔</data>
      <data name="size">1</data>
    </data>
    <data name="detail">
      <data name="リソース">
        <data type="numberResource" currentValue="30" name="HP">30</data>
        <data name="防護">3</data>
      </data>
      <data name="バフ・デバフ">
        <data type="numberResource" currentValue="0" name="回避修正">10</data>
      </data>
      <data name="情報">
        <data name="テスト">何かを記載</data>
      </data>
    </data>
  </data>
  <chat-palette dicebot="SwordWorld2.5" paletteColor="">2d+6+{回避修正} 回避</chat-palette>
</character>`;

/** XML からコマを組み立てる（取り込みはしない） */
export function parseCharacter(xml: string): GameCharacter {
  return ObjectSerializer.instance.parseXml(xml) as GameCharacter;
}

/** ヒブレイザンを取り込み済みの状態で作る。部位は 上半身 / 下半身 */
export function makeMultiPartCharacter(): GameCharacter {
  let character = parseCharacter(MULTI_PART_XML);
  YtsheetMultiPartImporter.convert(character);
  return character;
}
