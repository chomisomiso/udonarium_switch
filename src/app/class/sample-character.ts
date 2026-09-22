import { ImageStorage } from './core/file-storage/image-storage';
import { ObjectFactory } from './core/synchronize-object/object-factory';
import { ObjectNode } from './core/synchronize-object/object-node';
import { ObjectStore } from './core/synchronize-object/object-store';
import { XmlUtil } from './core/system/util/xml-util';
import { GameCharacter } from './game-character';
import { GameSystemSetting } from './game-system-setting';

/*
 * ルームに最初から置いておくサンプルのコマ。
 */

const MONSTER_A_XML = `
<character rotate="0" roll="0" isKomaImageHeightSpecified="false" komaImageHeightSetting="100" imageIndexSetting="1" isHiddenInInventory="false" isNonTalking="false" location.name="table" location.x="250" location.y="450" posZ="0" overViewWidthSetting="320" overViewMaxHeightSetting="0">
  <data name="character">
    <data name="image">
      <data name="imageIdentifier" type="image" imageName="ソード">./assets/images/mon_052.gif</data>
      <data name="imageIdentifier" type="image" imageName="アックス">./assets/images/mon_053.gif</data>
    </data>
    <data name="common">
      <data name="name">モンスターA</data>
      <data name="size">1</data>
    </data>
    <data name="detail">
      <data name="リソース">
        <data name="HP" type="numberResource" currentValue="10">16</data>
        <data name="MP" type="numberResource" currentValue="12">12</data>
      </data>
      <data name="情報">
        <data name="説明" type="note">キャラクターは複数のコマ画像を持てます。
コマの右クリック＞画像や詳細、チャット欄のキャラ画像クリックからも切り替えができます。</data>
      </data>
      <data name="能力">
        <data name="打撃点">2d+2</data>
        <data name="防護">2</data>
      </data>
    </data>
  </data>
  <chat-palette dicebot="SwordWorld2.5">▲パレットやダッシュボードのキャラ画像クリックでコマ画像を切り替えられます。
画像が一つしかない場合は何も起きません</chat-palette>
</character>`;

const MONSTER_B_XML = `
<character rotate="0" roll="0" isKomaImageHeightSpecified="false" komaImageHeightSetting="100" imageIndexSetting="0" isHiddenInInventory="false" isNonTalking="false" location.name="table" location.x="400" location.y="400" posZ="0" overViewWidthSetting="320" overViewMaxHeightSetting="0">
  <data name="character">
    <data name="image">
      <data type="image" name="imageIdentifier" imageName="ソード">./assets/images/mon_052.gif</data>
      <data type="image" name="imageIdentifier" imageName="アックス">./assets/images/mon_053.gif</data>
    </data>
    <data name="common">
      <data name="name">モンスターB</data>
      <data name="size">1</data>
    </data>
    <data name="detail">
      <data name="リソース">
        <data name="HP" type="numberResource" currentValue="9">16</data>
        <data name="MP" type="numberResource" currentValue="12">12</data>
      </data>
      <data name="情報">
        <data name="説明" type="note">キャラクターは複数のコマ画像を持てます。
コマの右クリック＞画像や詳細、チャット欄のキャラ画像クリックからも切り替えができます。</data>
      </data>
      <data name="能力">
        <data name="打撃点">2d+2</data>
        <data name="防護">2</data>
      </data>
    </data>
  </data>
  <chat-palette dicebot="SwordWorld2.5">▲パレットやダッシュボードのキャラ画像クリックでコマ画像を切り替えられます。
画像が一つしかない場合は何も起きません</chat-palette>
</character>`;

const MONSTER_C_XML = `
<character rotate="0" roll="0" isKomaImageHeightSpecified="true" komaImageHeightSetting="325" imageIndexSetting="0" isHiddenInInventory="false" isNonTalking="true" location.name="table" location.x="200" location.y="100" posZ="0" overViewWidthSetting="600" overViewMaxHeightSetting="0">
  <data name="character">
    <data name="image">
      <data name="imageIdentifier" type="image" imageCrop="100 47.8 1.51">./assets/images/mon_013.gif</data>
    </data>
    <data name="common">
      <data name="name">モンスターC</data>
      <data name="size">3</data>
    </data>
    <data name="detail">
      <data name="リソース">
        <data name="HP" type="numberResource" currentValue="43">52</data>
        <data name="MP" type="numberResource" currentValue="20">20</data>
      </data>
      <data name="情報">
        <data name="一言" type="note">幅広</data>
        <data name="説明" type="note">コマを右クリック＞設定
◆テーブルインベントリに表示しない
　これを設定したコマは、インベントリ・ダッシュボードに表示されません。戦闘に参加しないキャラなどに。

◆発言をしない
　チャットウィンドウから発言者に選べなくなります。データだけ置いておきたいコマなどに。

◆コマ画像の高さを指定
　デフォルトのコマ画像サイズは、コマの幅からはみ出ないようにスケールします。これを高さ指定に変更します。

◆ポップアップ横幅・縦幅最大
　このポップアップのサイズを変えられます。情報量の多いキャラは広いポップアップを設定、といった使い方ができます。</data>
      </data>
      <data name="能力">
        <data name="打撃点">2d+5</data>
        <data name="防護">7</data>
      </data>
    </data>
  </data>
  <chat-palette dicebot="SwordWorld2.5">
t:HP-({打撃点}-t{防護}) ダメージ</chat-palette>
</character>`;

const CHARACTER_A_XML = `
<character rotate="0" roll="0" isKomaImageHeightSpecified="true" komaImageHeightSetting="60" imageIndexSetting="0" isHiddenInInventory="false" isNonTalking="false" location.name="table" location.x="300" location.y="550" posZ="0" overViewWidthSetting="0" overViewMaxHeightSetting="0">
  <data name="character">
    <data name="image">
      <data name="imageIdentifier" type="image">./assets/images/mon_079.gif</data>
    </data>
    <data name="common">
      <data name="name">キャラクターA</data>
      <data name="size">1</data>
    </data>
    <data name="detail">
      <data name="リソース">
        <data type="numberResource" currentValue="35" name="HP">46</data>
        <data type="numberResource" currentValue="10" name="MP">13</data>
        <data name="防護">8</data>
        <data name="緑B">5</data>
      </data>
      <data name="情報">
        <data name="説明" type="note">コマの頭上のキャラ名をクリックするとバフが展開・格納されます。</data>
      </data>
      <data name="能力値">
        <data name="器用度">16</data>
        <data name="敏捷度">12</data>
        <data name="筋力">19</data>
        <data name="生命力">16</data>
        <data name="知力">10</data>
        <data name="精神力">13</data>
      </data>
      <data name="技能">
        <data name="ファイター">5</data>
        <data name="レンジャー">5</data>
        <data name="エンハンサー">3</data>
        <data name="アルケミスト">1</data>
      </data>
    </data>
  </data>
  <chat-palette dicebot="SwordWorld2.5" paletteColor="">
◆ バフ操作コマンド例
// &amp;バフ名/時間/効果 でバフをかけられます
// 時間・効果は省略可能です
&amp;全力攻撃/ダメージ＋４回避ー２

// 効果でキャラシートの数値を操作することもできます
// バフが解除されると数値も戻ります
&amp;ビースキ/3/防護+2 :MP-3
&amp;バクメB/18/防護+1 :緑B-1

// 別のコマをダブルクリックして、そのキャラにもバフをかけられます
// 先頭に't'をつけます
t&amp;バクメB/18/防護+1 :緑B-1

</chat-palette>
  <buff-list>
    <buff buffName="ビースキ" effect="防護+2" roundsValue="3"></buff>
  </buff-list>
</character>`;

const CHARACTER_B_XML = `
<character rotate="0" roll="0" isKomaImageHeightSpecified="false" komaImageHeightSetting="100" imageIndexSetting="0" isHiddenInInventory="false" isNonTalking="false" location.name="table" location.x="600" location.y="600" posZ="0" overViewWidthSetting="0" overViewMaxHeightSetting="701">
  <data name="character">
    <data name="image">
      <data name="imageIdentifier" type="image">./assets/images/mon_018.gif</data>
    </data>
    <data name="common">
      <data name="name">キャラクターB</data>
      <data name="size">1</data>
    </data>
    <data name="detail">
      <data name="リソース">
        <data type="numberResource" currentValue="21" name="HP">21</data>
        <data type="numberResource" currentValue="37" name="MP">49</data>
        <data name="防護">2</data>
      </data>
      <data name="情報">
        <data name="説明" type="note">キャラデータの数値は、チャットパレットからも使えます。
よくバフする能力などを記載しておいて、チャットパレットからリソース操作コマンドで参照すると捗ります。
ゆとシートⅡから出力したコマには、デフォルトでバフ・デバフ用のデータがついてきます。</data>
      </data>
      <data name="能力値">
        <data name="器用度">10</data>
        <data name="敏捷度">14</data>
        <data name="筋力">5</data>
        <data name="生命力">6</data>
        <data name="知力">23</data>
        <data name="精神力">19</data>
      </data>
      <data name="技能">
        <data name="ソーサラー">5</data>
        <data name="コンジャラー">5</data>
        <data name="セージ">4</data>
      </data>
      <data name="バフ・デバフ">
        <data type="numberResource" currentValue="0" name="魔力修正">10</data>
        <data type="numberResource" currentValue="0" name="行使修正">10</data>
        <data type="numberResource" currentValue="10" name="魔法C">10</data>
        <data type="numberResource" currentValue="0" name="魔法D修正">10</data>
        <data type="numberResource" currentValue="0" name="回復量修正">10</data>
        <data type="numberResource" currentValue="0" name="生命抵抗修正">10</data>
        <data type="numberResource" currentValue="0" name="精神抵抗修正">10</data>
        <data type="numberResource" currentValue="0" name="回避修正">10</data>
      </data>
    </data>
  </data>
  <chat-palette dicebot="SwordWorld2.5">◆索引機能
// 「◆」「###」「//---」を行頭につけると、索引としてジャンプできます。

// ゆとシートⅡ for SW2.5* から出力したコマのパレットサンプル
// デフォルトでは、バフ・デバフ変数がキャラの持つ数値として出力されます。
// パレットにも組み込まれているので、リソース・バフ操作コマンドと組み合わせると便利です。
// *©ゆとらいず工房様(https://yutorize.work/ytsheet/sw2.5/)
&amp;カンタマ/18R/精神抵抗修正+2

### ■非戦闘系・魔物知識
2d+5+1 冒険者＋器用
2d+5+2 冒険者＋敏捷
2d+5+1 冒険者＋筋力
2d+5+1 冒険者＋生命
2d+5+4 冒険者＋知力
2d+5+3 冒険者＋精神
2d+4+4 セージ知識

### ■魔法系
2d+9+{魔力修正}+{行使修正} 真語魔法行使
k10[({魔法C})]+9+{魔力修正}+{魔法D修正} ダメージ／真語魔法
k20[({魔法C})]+9+{魔力修正}+{魔法D修正} ダメージ／真語魔法
k30[({魔法C})]+9+{魔力修正}+{魔法D修正} ダメージ／真語魔法
k10[13]+9+{魔力修正}h+(+{魔法D修正}) 半減／真語魔法
k20[13]+9+{魔力修正}h+(+{魔法D修正}) 半減／真語魔法
k30[13]+9+{魔力修正}h+(+{魔法D修正}) 半減／真語魔法

2d+9+{魔力修正}+{行使修正} 操霊魔法行使
k0[({魔法C})]+9+{魔力修正}+{魔法D修正} ダメージ／操霊魔法
k0[13]+9+{魔力修正}h+(+{魔法D修正}) 半減／操霊魔法
k0[13]+9+{魔力修正}+{回復量修正} 回復量

2d+9+{魔力修正}+{行使修正} 深智魔法行使
k20[({魔法C})]+9+{魔力修正}+{魔法D修正} ダメージ／深智魔法
k20[13]+9+{魔力修正}h+(+{魔法D修正}) 半減／深智魔法

### ■抵抗回避
2d+6+{生命抵抗修正} 生命抵抗力
2d+8+{精神抵抗修正} 精神抵抗力
2d+0+{回避修正} 回避力</chat-palette>
</character>`;

const CHARACTER_C_XML = `
<character rotate="0" roll="0" isKomaImageHeightSpecified="false" komaImageHeightSetting="100" imageIndexSetting="0" isHiddenInInventory="false" isNonTalking="false" location.name="table" location.x="250" location.y="650" posZ="0" overViewWidthSetting="0" overViewMaxHeightSetting="400">
  <data name="character">
    <data name="image">
      <data name="imageIdentifier" type="image">./assets/images/mon_220.gif</data>
    </data>
    <data name="common">
      <data name="name">キャラクターC</data>
      <data name="size">1</data>
    </data>
    <data name="detail">
      <data name="リソース">
        <data type="numberResource" currentValue="30" name="HP">30</data>
        <data type="numberResource" currentValue="0" name="MP">0</data>
        <data name="防護">2</data>
        <data name="⤴">0</data>
        <data name="⤵">0</data>
        <data name="♡">0</data>
      </data>
      <data name="情報">
        <data name="説明" type="note">ポップアップに表示する項目は、
「メニュー ＞ インベントリ ＞ 設定」
から変更できます</data>
      </data>
      <data name="能力値">
        <data name="器用度">23</data>
        <data name="敏捷度">20</data>
        <data name="筋力">8</data>
        <data name="生命力">15</data>
        <data name="知力">19</data>
        <data name="精神力">26</data>
      </data>
      <data name="技能">
        <data name="バード">5</data>
        <data name="スカウト">5</data>
        <data name="フェンサー">3</data>
        <data name="レンジャー">1</data>
      </data>
    </data>
  </data>
  <chat-palette dicebot="SwordWorld2.5" paletteColor="">
◆ リソース操作コマンド例
// ':リソース名±数値' でキャラシートの数値を操作できます
// 増減を管理したいものはキャラシートに追加しておくと便利です
:⤴+1 楽素を追加
:⤵+1 楽素を追加
:♡+1 楽素を追加

// 右辺にはダイス式が使えます
// 別のコマをダブルクリックして、そのキャラのリソースも操作できます
// 先頭には't'をつけます
t:HP+k20@13+{レンジャー}L ポーションを味方に使う

  </chat-palette>
</character>`;

const CHARACTER_D_XML = `
<character rotate="0" roll="0" isKomaImageHeightSpecified="true" komaImageHeightSetting="50" imageIndexSetting="0" isHiddenInInventory="true" isNonTalking="false" location.name="table" location.x="550" location.y="700" posZ="0" overViewWidthSetting="250" overViewMaxHeightSetting="600">
  <data name="character">
    <data name="image">
      <data name="imageIdentifier" type="image">./assets/images/mon_211.gif</data>
    </data>
    <data name="common">
      <data name="name">キャラクターD</data>
      <data name="size">1</data>
    </data>
    <data name="detail">
      <data name="情報">
        <data name="一言" type="note">小さいけど伸びしろがあります</data>
        <data name="説明" type="note">コマを右クリック＞設定
◆テーブルインベントリに表示しない
　これを設定したコマは、インベントリ・ダッシュボードに表示されません。戦闘に参加しないキャラなどに。

◆発言をしない
　チャットウィンドウから発言者に選べなくなります。データだけ置いておきたいコマなどに。

◆コマ画像の高さを指定
　デフォルトのコマ画像サイズは、コマの幅からはみ出ないようにスケールします。これを高さ指定に変更します。

◆ポップアップ横幅・縦幅最大
　このポップアップのサイズを変えられます。情報量の多いキャラは広いポップアップを設定、といった使い方ができます。</data>
      </data>
    </data>
  </data>
  <chat-palette dicebot="SwordWorld2.5" paletteColor=""></chat-palette>
</character>`;

export class SampleCharacter {
  static readonly sources: readonly string[] = [
    MONSTER_A_XML,
    MONSTER_B_XML,
    MONSTER_C_XML,
    CHARACTER_A_XML,
    CHARACTER_B_XML,
    CHARACTER_C_XML,
    CHARACTER_D_XML,
  ];

  /**
   * サンプルのコマを一括で作る。XML の書き損じたものと、作成済み・削除済みのものは飛ばす。
   */
  static createAll(): GameCharacter[] {
    let characters: GameCharacter[] = [];
    SampleCharacter.sources.forEach((xml, index) => {
      let character = SampleCharacter.create(xml, `SampleCharacter_${index}`);
      if (character) characters.push(character);
    });
    return characters;
  }

  /**
   * 入室時に各ピアのサンプルが同期されても増えないよう、子孫まで全ピア共通の identifier で作る
   */
  static create(xml: string, identifier: string): GameCharacter | null {
    if (ObjectStore.instance.get(identifier) || ObjectStore.instance.isDeleted(identifier)) return null;

    let element = XmlUtil.xml2element(xml);
    if (!element || element.tagName !== GameCharacter.aliasName) return null;

    let object = SampleCharacter.parseNode(element, identifier);
    if (!(object instanceof GameCharacter)) return null;

    for (let element of object.imageElements) {
      let url = <string>element.value;
      if (url) ImageStorage.instance.add(url);
    }

    if (object.chatPalette) object.chatPalette.dicebot = GameSystemSetting.instance.gameType;

    return object;
  }

  /**
   * ObjectSerializer.parseXml と ObjectNode.parseInnerXml の手順で、identifier を決め打ちして組み立てる。
   */
  private static parseNode(element: Element, identifier: string): ObjectNode | null {
    let node = ObjectFactory.instance.create(element.tagName, identifier);
    if (!(node instanceof ObjectNode)) return null;

    node.parseAttributes(element.attributes);
    node.initialize();

    let children = element.children;
    if (children.length < 1) {
      node.value = XmlUtil.decodeEntityReference(element.innerHTML);
      return node;
    }
    for (let i = 0; i < children.length; i++) {
      let child = SampleCharacter.parseNode(children[i], `${identifier}_${i}`);
      if (child) node.appendChild(child);
    }
    return node;
  }
}
