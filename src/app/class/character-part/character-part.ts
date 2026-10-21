import { Buff } from '../buff';
import { BuffList, BuffResourceOwner } from '../buff-list';
import { VariableSource } from '../chat-palette';
import { SyncObject, SyncVar } from '../core/synchronize-object/decorator';
import { ObjectNode } from '../core/synchronize-object/object-node';
import { DataElement, DataElementAccessor } from '../data-element';

/** 部位が持つデータ要素のルートの名前 */
const PART_DATA_NAME = 'part';

/**
 * 部位が持ち主に求めるもの。`GameCharacter` が満たす。
 */
export interface PartOwner {
  readonly name: string;
  readonly rootDataElement: DataElement;
  findDataElement(dataName: string): DataElement | null;
}

/**
 * 多部位コマ（SW2.5 の魔物など）の部位。`GameCharacter` の直下に並ぶ。
 *
 * 部位ごとに持つのはリソース及びバフコンテナ。パレットや情報は共有。
 * データ要素は部位→持ち主の順に探すため、部位に無いものは共有要素の値が引ける。
 */
@SyncObject('character-part')
export class CharacterPart extends ObjectNode implements BuffResourceOwner {
  /** リソースを含むグループか。部位化では丸ごと部位へ移し、取り込みでは部位を名乗らない残りを情報へまわす */
  static holdsResources(group: DataElement): boolean {
    return group.children.some(child => child instanceof DataElement && child.isNumberResource);
  }

  /**
   * `name` にはしない。ObjectNode の @SyncVar は attributes に入るので、
   * TabletopObject.rootDataElement（子の name 属性でルートを拾う）に部位が引っかかりうる
   */
  @SyncVar() partName: string = '';

  private get owner(): PartOwner | null {
    let parent = this.parent as unknown as PartOwner;
    return parent && typeof parent.findDataElement === 'function' ? parent : null;
  }

  get dataElement(): DataElement | null {
    for (let child of this.children) {
      if (child instanceof DataElement && child.name === PART_DATA_NAME) return child;
    }
    return null;
  }

  /** チャットやコマンド結果に出す名前。 */
  get label(): string {
    let owner = this.owner;
    return `${owner ? owner.name : ''}(${this.partName})`;
  }

  /** 部位自身のデータ要素だけを探す */
  findOwnDataElement(dataName: string): DataElement | null {
    let data = this.dataElement;
    return data ? data.getFirstElementByName(dataName) : null;
  }

  /** 部位→持ち主の順に探す */
  findDataElement(dataName: string): DataElement | null {
    let own = this.findOwnDataElement(dataName);
    if (own) return own;
    let owner = this.owner;
    return owner ? owner.findDataElement(dataName) : null;
  }

  getDataString(dataName: string): string { return DataElementAccessor.getString(this.findDataElement(dataName)); }
  getCurrentDataValue(dataName: string): number { return DataElementAccessor.getCurrent(this.findDataElement(dataName)); }
  getMaxDataValue(dataName: string): number { return DataElementAccessor.getMax(this.findDataElement(dataName)); }
  setDataString(dataName: string, setString: string): boolean { return DataElementAccessor.setString(this.findDataElement(dataName), setString); }
  setCurrentDataValue(dataName: string, setValue: number): boolean { return DataElementAccessor.setCurrent(this.findDataElement(dataName), setValue); }
  setMaxDataValue(dataName: string, setValue: number): boolean { return DataElementAccessor.setMax(this.findDataElement(dataName), setValue); }

  /** パレットの {名前} の引き先。部位の data → 持ち主の data の順 */
  get variables(): VariableSource {
    return {
      getFirstElementByName: (name, option) => {
        let own = this.dataElement?.getFirstElementByName(name, option);
        if (own) return own;
        return this.owner?.rootDataElement?.getFirstElementByName(name, option) ?? null;
      }
    };
  }

  // --- バフ ---

  get buffList(): BuffList { return BuffList.findIn(this); }
  get buffs(): Buff[] { return this.buffList ? this.buffList.buffs : []; }
  ensureBuffList(): BuffList { return BuffList.ensureIn(this); }

  /** @param data 部位のデータ要素の雛形。名前は部位のルートの名前に揃える */
  static create(partName: string, data?: DataElement): CharacterPart {
    let part = new CharacterPart();
    part.partName = partName;
    part.initialize();

    if (!data) data = DataElement.create(PART_DATA_NAME, '', {});
    data.name = PART_DATA_NAME;
    part.appendChild(data);
    return part;
  }
}
