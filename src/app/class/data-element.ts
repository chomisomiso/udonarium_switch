import { Attributes } from './core/synchronize-object/attributes';
import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { ObjectNode } from './core/synchronize-object/object-node';
import { CompareOption, StringUtil } from './core/system/util/string-util';

@SyncObject('data')
export class DataElement extends ObjectNode {
  @SyncVar() name: string;
  @SyncVar() type: string;
  @SyncVar() currentValue: number | string;

  get isNumberResource(): boolean { return this.type != null && this.type === 'numberResource'; }
  get isNote(): boolean { return this.type != null && this.type === 'note'; }

  public static create(name: string, value: number | string = '', attributes: Attributes = {}, identifier: string = ''): DataElement {
    let dataElement: DataElement;
    if (identifier && 0 < identifier.length) {
      dataElement = new DataElement(identifier);
    } else {
      dataElement = new DataElement();
    }
    dataElement.attributes = attributes;
    dataElement.name = name;
    dataElement.value = value;
    dataElement.initialize();

    return dataElement;
  }

  getElementsByName(name: string, option: CompareOption = CompareOption.None): DataElement[] {
    let children: DataElement[] = [];
    for (let child of this.children) {
      if (child instanceof DataElement) {
        if (StringUtil.equals(child.getAttribute('name'), name, option)) children.push(child);
        Array.prototype.push.apply(children, child.getElementsByName(name, option));
      }
    }
    return children;
  }

  getElementsByType(type: string, option: CompareOption = CompareOption.None): DataElement[] {
    let children: DataElement[] = [];
    for (let child of this.children) {
      if (child instanceof DataElement) {
        if (StringUtil.equals(child.getAttribute('type'), type, option)) children.push(child);
        Array.prototype.push.apply(children, child.getElementsByType(type, option));
      }
    }
    return children;
  }

  getFirstElementByName(name: string, option: CompareOption = CompareOption.None): DataElement {
    for (let child of this.children) {
      if (child instanceof DataElement) {
        if (StringUtil.equals(child.getAttribute('name'), name, option)) return child;
        let match = child.getFirstElementByName(name, option);
        if (match) return match;
      }
    }
    return null;
  }
}

/**
 * データ要素の値を、型（numberResource / note / 型なし）に応じて読み書きする。
 * 要素が無ければ null を返す。
 */
export namespace DataElementAccessor {
  export function getString(data: DataElement | null): string {
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

  export function getCurrent(data: DataElement | null): number {
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

  export function getMax(data: DataElement | null): number {
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

  export function setString(data: DataElement | null, text: string): boolean {
    if (!data) return null;
    switch (data.type) {
      case 'numberResource':
        return false;
      case undefined:
        data.value = text;
        return true;
      case 'note':
        data.currentValue = text;
        return true;
    }
    return false;
  }

  /**
   * NaN は書き込まない。一度書くと表示も以後の計算も壊れたまま同期され、
   * 補正コマンドを撃っても NaN のままで元の値には戻せない。
   * 非数値タグを対象にしたリソースコマンドやバフ効果は、ここで書き込みごと落ちる
   */
  export function setCurrent(data: DataElement | null, value: number): boolean {
    if (Number.isNaN(value)) return false;
    if (!data) return null;
    switch (data.type) {
      case 'numberResource':
        data.currentValue = value;
        return true;
      case undefined:
        data.value = value;
        return true;
      case 'note':
        return false;
    }
    return false;
  }

  export function setMax(data: DataElement | null, value: number): boolean {
    if (Number.isNaN(value)) return false;
    if (!data) return null;
    switch (data.type) {
      case 'numberResource':
        data.value = value;
        return true;
      case undefined:
        return false;
      case 'note':
        return false;
    }
    return false;
  }
}
