import { Buff } from './buff';
import { BuffList, BuffResourceOwner } from './buff-list';
import { ChatPalette } from './chat-palette';
import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { MathUtil } from './core/system/util/math-util';
import { DataElement } from './data-element';
import { GameSystemSetting } from './game-system-setting';
import { TabletopObject } from './tabletop-object';

@SyncObject('character')
export class GameCharacter extends TabletopObject implements BuffResourceOwner {
  @SyncVar() rotate: number = 0;
  @SyncVar() roll: number = 0;

  static readonly minKomaImageHeight: number = 50;
  static readonly maxKomaImageHeight: number = 750;

  /** コマ画像を高さ基準でスケールするモードと、その高さ（px） */
  @SyncVar() isKomaImageHeightSpecified: boolean = false;
  @SyncVar() komaImageHeightSetting: number = 100;
  /** 複数登録したコマ画像のうち、現在表示しているものの番号（0 起点） */
  @SyncVar() imageIndexSetting: number = 0;

  /** テーブルに置いたままテーブルインベントリの一覧から除外する */
  @SyncVar() isHiddenInInventory: boolean = false;
  /** チャットの発言者リストに表示しない */
  @SyncVar() isNonTalking: boolean = false;

  /** テーブル上にあり、一覧に出してよいコマか。DI の外からも要るのでここに置く。 */
  get isVisibleInInventory(): boolean { return this.isVisibleOnTable && !this.isHiddenInInventory; }

  /** 一覧の表示に効く値のうち、DataElement に乗らないものを列挙。別ピア表示用。 */
  get inventoryRenderKey(): string {
    return `${this.isHiddenInInventory}:${this.imageIndexSetting}`;
  }

  get komaImageHeight(): number { return GameCharacter.clampKomaImageHeight(this.komaImageHeightSetting); }
  set komaImageHeight(height: number) { this.komaImageHeightSetting = GameCharacter.clampKomaImageHeight(+height); }

  private static clampKomaImageHeight(height: number): number {
    return MathUtil.clamp(height, this.minKomaImageHeight, this.maxKomaImageHeight);
  }

  /** 登録されているコマ画像。image 要素の子がそのまま画像のリストになる */
  get imageElements(): DataElement[] { return this.imageDataElement ? <DataElement[]>this.imageDataElement.children : []; }
  get imageCount(): number { return this.imageElements.length; }
  /** 実際に表示している画像の番号。他のピアが画像を削除して枚数が減ることがあるため、クランプは読み出し時に行う。 */
  get imageIndex(): number { return MathUtil.clamp(this.imageIndexSetting, 0, this.imageCount - 1); }
  set imageIndex(index: number) { this.imageIndexSetting = MathUtil.clamp(+index, 0, this.imageCount - 1); }

  protected get currentImageElement(): DataElement { return this.imageElements[this.imageIndex] ?? null; }

  /** 画像の表示名。ユーザーが任意で付けるもので、未設定なら空文字 */
  static getImageName(element: DataElement): string {
    return element ? element.getAttribute('imageName') : '';
  }
  static setImageName(element: DataElement, name: string) {
    if (!element) return;
    if (name) {
      element.setAttribute('imageName', name);
    } else {
      element.removeAttribute('imageName');
    }
  }

  addImageElement(): DataElement | null {
    if (!this.imageDataElement) return null;
    return this.imageDataElement.appendChild(DataElement.create('imageIdentifier', '', { type: 'image' }));
  }

  /** 画像を削除する。最後の 1 枚は削除しない */
  removeImageElement(index: number): boolean {
    if (this.imageCount <= 1) return false;
    let element = this.imageElements[index];
    if (!element) return false;

    let current = this.imageIndex;
    element.destroy();
    // 選択中より前を削除したときは表示画像が変わらないように番号を詰める。
    // 末尾を消して範囲外になった場合もここで正規化しないと、画像を足し直したときに選択が飛ぶ
    let next = MathUtil.clamp(index < current ? current - 1 : current, 0, this.imageCount - 1);
    if (this.imageIndexSetting !== next) this.imageIndexSetting = next;
    return true;
  }

  /** 画像を隣と入れ替える。offset は符号だけを見る */
  moveImageElement(index: number, offset: number) {
    let elements = this.imageElements;
    let to = index + Math.sign(offset);
    if (!elements[index] || !elements[to]) return;

    if (to < index) {
      this.imageDataElement.insertBefore(elements[index], elements[to]);
    } else {
      this.imageDataElement.insertBefore(elements[to], elements[index]);
    }
    // 入れ替えに合わせて選択中の番号も追従させる
    let current = this.imageIndex;
    if (current === index) this.imageIndex = to;
    else if (current === to) this.imageIndex = index;
  }

  get name(): string { return this.getCommonValue('name', ''); }
  get size(): number { return this.getCommonValue('size', 1); }

  get chatPalette(): ChatPalette {
    for (let child of this.children) {
      if (child instanceof ChatPalette) return child;
    }
    return null;
  }

  static create(name: string, size: number, imageIdentifier: string): GameCharacter {
    let gameCharacter: GameCharacter = new GameCharacter();
    gameCharacter.createDataElements();
    gameCharacter.initialize();
    gameCharacter.createTestGameDataElement(name, size, imageIdentifier);

    return gameCharacter;
  }

  createTestGameDataElement(name: string, size: number, imageIdentifier: string) {
    this.createDataElements();

    let nameElement: DataElement = DataElement.create('name', name, {}, 'name_' + this.identifier);
    let sizeElement: DataElement = DataElement.create('size', size, {}, 'size_' + this.identifier);

    if (this.imageDataElement.getFirstElementByName('imageIdentifier')) {
      this.imageDataElement.getFirstElementByName('imageIdentifier').value = imageIdentifier;
    }

    let resourceElement: DataElement = DataElement.create('リソース', '', {}, 'リソース' + this.identifier);
    let hpElement: DataElement = DataElement.create('HP', 200, { 'type': 'numberResource', 'currentValue': '200' }, 'HP_' + this.identifier);
    let mpElement: DataElement = DataElement.create('MP', 100, { 'type': 'numberResource', 'currentValue': '100' }, 'MP_' + this.identifier);

    this.commonDataElement.appendChild(nameElement);
    this.commonDataElement.appendChild(sizeElement);

    this.detailDataElement.appendChild(resourceElement);
    resourceElement.appendChild(hpElement);
    resourceElement.appendChild(mpElement);

    //TEST
    let testElement: DataElement = DataElement.create('情報', '', {}, '情報' + this.identifier);
    this.detailDataElement.appendChild(testElement);
    testElement.appendChild(DataElement.create('説明', 'ここに説明を書く\nあいうえお', { 'type': 'note' }, '説明' + this.identifier));
    testElement.appendChild(DataElement.create('メモ', '任意の文字列\n１\n２\n３\n４\n５', { 'type': 'note' }, 'メモ' + this.identifier));

    //TEST
    testElement = DataElement.create('能力', '', {}, '能力' + this.identifier);
    this.detailDataElement.appendChild(testElement);
    testElement.appendChild(DataElement.create('器用度', 24, {}, '器用度' + this.identifier));
    testElement.appendChild(DataElement.create('敏捷度', 24, {}, '敏捷度' + this.identifier));
    testElement.appendChild(DataElement.create('筋力', 24, {}, '筋力' + this.identifier));
    testElement.appendChild(DataElement.create('生命力', 24, {}, '生命力' + this.identifier));
    testElement.appendChild(DataElement.create('知力', 24, {}, '知力' + this.identifier));
    testElement.appendChild(DataElement.create('精神力', 24, {}, '精神力' + this.identifier));

    //TEST
    testElement = DataElement.create('戦闘特技', '', {}, '戦闘特技' + this.identifier);
    this.detailDataElement.appendChild(testElement);
    testElement.appendChild(DataElement.create('Lv1', '全力攻撃', {}, 'Lv1' + this.identifier));
    testElement.appendChild(DataElement.create('Lv3', '武器習熟/ソード', {}, 'Lv3' + this.identifier));
    testElement.appendChild(DataElement.create('Lv5', '武器習熟/ソードⅡ', {}, 'Lv5' + this.identifier));
    testElement.appendChild(DataElement.create('Lv7', '頑強', {}, 'Lv7' + this.identifier));
    testElement.appendChild(DataElement.create('Lv9', '薙ぎ払い', {}, 'Lv9' + this.identifier));
    testElement.appendChild(DataElement.create('自動', '治癒適正', {}, '自動' + this.identifier));

    let domParser: DOMParser = new DOMParser();
    let gameCharacterXMLDocument: Document = domParser.parseFromString(this.rootDataElement.toXml(), 'application/xml');

    let palette: ChatPalette = new ChatPalette('ChatPalette_' + this.identifier);
    palette.dicebot = GameSystemSetting.instance.gameType; // ルーム設定に追随
    palette.setPalette(`チャットパレット入力例：
2d6+1 ダイスロール
１ｄ２０＋{敏捷}＋｛格闘｝　{name}の格闘！
//敏捷=10+{敏捷A}
//敏捷A=10
//格闘＝１`);
    palette.initialize();
    this.appendChild(palette);
  }

  getDataString(dataName: string): string {
    const data = this.detailDataElement.getFirstElementByName(dataName);
    if (!data) return null;
    switch (data.type) {
      case 'numberResource':
        return data.currentValue as string;
      case undefined:
        return data.value as string;
      case 'note':
        return data.currentValue as string;
    }
    return null;
  }

  getCurrentDataValue(dataName: string): number {
    const data = this.detailDataElement.getFirstElementByName(dataName);
    if (!data) return null;
    switch (data.type) {
      case 'numberResource':
        return parseInt(data.currentValue as string);
      case undefined:
        return parseInt(data.value as string);
      case 'note':
        return NaN;
    }
    return NaN;
  }

  getMaxDataValue(dataName: string): number {
    const data = this.detailDataElement.getFirstElementByName(dataName);
    if (!data) return null;
    switch (data.type) {
      case 'numberResource':
        return parseInt(data.value as string);
      case undefined:
        return NaN;
      case 'note':
        return NaN;
    }
    return NaN;
  }

  setDataString(dataName: string, setString: string): boolean {
    const data = this.detailDataElement.getFirstElementByName(dataName);
    if (!data) return null;
    switch (data.type) {
      case 'numberResource':
        return false;
      case undefined:
        data.value = setString;
        return true;
      case 'note':
        data.currentValue = setString;
        return true;
    }
    return false;
  }

  /**
   * NaN は書き込まない。一度書くと表示も以後の計算も壊れたまま同期され、
   * 補正コマンドを撃っても NaN のままで元の値には戻せない。
   * 非数値タグを対象にしたリソースコマンドやバフ効果は、ここで書き込みごと落ちる
   */
  setCurrentDataValue(dataName: string, setValue: number): boolean {
    if (Number.isNaN(setValue)) return false;
    const data = this.detailDataElement.getFirstElementByName(dataName);
    if (!data) return null;
    switch (data.type) {
      case 'numberResource':
        data.currentValue = setValue;
        return true;
      case undefined:
        data.value = setValue;
        return true;
      case 'note':
        return false;
    }
    return false;
  }

  setMaxDataValue(dataName: string, setValue: number): boolean {
    if (Number.isNaN(setValue)) return false;
    const data = this.detailDataElement.getFirstElementByName(dataName);
    if (!data) return null;
    switch (data.type) {
      case 'numberResource':
        data.value = setValue;
        return true;
      case undefined:
        return false;
      case 'note':
        return false;
    }
    return false;
  }

  // --- バフ ---

  /**
   * バフの入れ物。持っていなければ null（chatPalette と同じ形）。
   * 追加・削除・編集は必ずここを通す。バフの効果はリソースの現在値を直接動かすので、
   * 別ルートから書き換えると打ち消しの辻褄が合わなくなる
   */
  get buffList(): BuffList {
    for (let child of this.children) {
      if (child instanceof BuffList) return child;
    }
    return null;
  }

  get buffs(): Buff[] { return this.buffList ? this.buffList.buffs : []; }

  /**
   * バフを足すときに入れ物を遅延生成する。空になっても消さない
   * （削除と再生成が P2P で競ると、片方のバフが行方不明になる）。
   *
   * 識別子はコマから決まる形にする。2つのピアが同じコマへ同時にバフを足しても、
   * 同じ識別子なら同期で1つへ収束する
   */
  ensureBuffList(): BuffList {
    let buffList = this.buffList;
    if (buffList) return buffList;

    buffList = new BuffList('BuffList_' + this.identifier);
    buffList.initialize();
    return this.appendChild(buffList);
  }
}
