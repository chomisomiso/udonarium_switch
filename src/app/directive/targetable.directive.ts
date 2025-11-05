import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output
} from '@angular/core';
import { GameCharacter } from '@udonarium/game-character';
import { GameCharacterTargetingService, TargetState } from 'service/game-character-targeting.service';
import { BatchService } from 'service/batch.service';
import { IPoint2D, Transform } from '@udonarium/transform/transform';

export interface TargetableOption {
  readonly gameCharacter?: GameCharacter;
}

@Directive({
  selector: '[appTargetable]'
})
export class TargetableDirective implements AfterViewInit, OnChanges, OnDestroy {
  private _gameCharacter: GameCharacter;

  get gameCharacter(): GameCharacter { return this._gameCharacter; }

  @Input('targetable.option') set option(option: TargetableOption) {
    this.unregister();

    this._gameCharacter = option.gameCharacter ?? null;

    this.register();
  }
  @Input('targetable.disable') isDisable: boolean = false;
  @Output('targetable.onstart') onstart: EventEmitter<PointerEvent> = new EventEmitter();
  @Output('targetable.onend') onend: EventEmitter<PointerEvent> = new EventEmitter();

  get nativeElement(): HTMLElement { return this.elementRef.nativeElement; }

  private latestDomRect: DOMRect;
  private latestRectPoints: IPoint2D[] = [];

  get state(): TargetState { return this.targetingService.state(this.gameCharacter); }
  set state(state: TargetState) { this.targetingService.add(this.gameCharacter, state); }

  private callbackOnTargetRegion = this.onTargetRegion.bind(this);
  private callbackOnTargetObject = this.onTargetObject.bind(this);

  constructor(
    private elementRef: ElementRef,
    private targetingService: GameCharacterTargetingService,
    private batchService: BatchService
  ) { }

  ngAfterViewInit() {
    this.batchService.add(() => this.initialize(), this.onstart);
  }

  ngOnChanges(): void {
    this.dispose();
    this.addEventListeners();
    if (this.isDisable && this.state !== TargetState.NONE) this.state = TargetState.NONE;
  }

  ngOnDestroy() {
    this.unregister();
    this.dispose();
  }

  initialize() {
    this.register();
    this.addEventListeners();
  }

  destroy() {
    this.unregister();
    this.removeEventListeners();
  }

  dispose() {
    this.removeEventListeners();
  }

  private onTargetObject(e: CustomEvent) {
    if (this.isDisable) return;
    this.toggleState();
  }

  private onTargetRegion(e: CustomEvent) {
    if (this.isDisable) return;

    let x: number = e.detail.x;
    let y: number = e.detail.y;
    let width: number = e.detail.width;
    let height: number = e.detail.height;

    let targetRect = this.nativeElement.getBoundingClientRect();

    let isMaybeOverlap = targetRect.x <= x + width && x <= targetRect.x + targetRect.width && targetRect.y <= y + height && y <= targetRect.y + targetRect.height;
    if (!isMaybeOverlap) {
      this.state = TargetState.NONE;
      return;
    }

    let hasUpdatedRect = !(this.latestDomRect != null
      && this.latestDomRect.x === targetRect.x
      && this.latestDomRect.y === targetRect.y
      && this.latestDomRect.width === targetRect.width
      && this.latestDomRect.height === targetRect.height
      && this.latestDomRect.top === targetRect.top
      && this.latestDomRect.left === targetRect.left
      && this.latestDomRect.bottom === targetRect.bottom
      && this.latestDomRect.right === targetRect.right);

    if (hasUpdatedRect) {
      let points: IPoint2D[] = [
        { x: 0, y: 0 },
        { x: this.nativeElement.clientWidth, y: 0 },
        { x: this.nativeElement.clientWidth, y: this.nativeElement.clientHeight },
        { x: 0, y: this.nativeElement.clientHeight },
      ];
      let transformer: Transform = new Transform(this.nativeElement);
      this.latestDomRect = targetRect;
      this.latestRectPoints = points.map(point => transformer.localToGlobal(point.x, point.y));
      transformer.clear();
    }

    let rectA: IPoint2D[] = [
      { x: x, y: y },
      { x: x + width, y: y },
      { x: x + width, y: y + height },
      { x: x, y: y + height },
    ];
    let rectB: IPoint2D[] = this.latestRectPoints;

    let isOverlap = checkOverlapSAT(rectA, rectB);
    this.state = isOverlap ? TargetState.TARGETED : TargetState.NONE;
  }

  private toggleState() {
    this.state = this.state === TargetState.NONE
      ? TargetState.TARGETED
      : TargetState.NONE
  }

  private addEventListeners () {console.log('addEventListeners')
    this.nativeElement.addEventListener('targetobject', this.callbackOnTargetObject);
    this.nativeElement.ownerDocument.addEventListener('targetregion', this.callbackOnTargetRegion);
  }

  private removeEventListeners () {
    this.nativeElement.removeEventListener('targetobject', this.callbackOnTargetObject);
    this.nativeElement.ownerDocument.removeEventListener('targetregion', this.callbackOnTargetRegion);
  }

  private register() {
    this.targetingService.add(this.gameCharacter, this.state);
  }

  private unregister() {
    this.targetingService.remove(this.gameCharacter);
  }
}

// TODO: movable-selection-synchronizerとロジック重複
function checkOverlapSAT(rectA: IPoint2D[], rectB: IPoint2D[]) {
  let edges = [...getEdges(rectA), ...getEdges(rectB)];

  for (let edge of edges) {
    let axis = { x: -edge.y, y: edge.x }; // 法線ベクトル
    let projA = projectOntoAxis(rectA, axis);
    let projB = projectOntoAxis(rectB, axis);

    let isProjectionsOverlap = !(projA.max < projB.min || projB.max < projA.min);
    if (!isProjectionsOverlap) return false;
  }

  return true; // すべての軸で投影が重なるなら接触している
}

function getEdges(points: IPoint2D[]): IPoint2D[] {
  let edges = [];
  for (let i = 0; i < points.length; i++) {
    let next = (i + 1) % points.length;
    edges.push({ x: points[next].x - points[i].x, y: points[next].y - points[i].y });
  }
  return edges;
}

function projectOntoAxis(points: IPoint2D[], axis: IPoint2D): { min: number, max: number } {
  let min = Infinity, max = -Infinity;
  for (let p of points) {
    let projection = (p.x * axis.x + p.y * axis.y);
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}
