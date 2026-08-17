import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output
} from '@angular/core';
import { GameCharacter } from '@udonarium/game-character';
import { RegionOverlapDetector } from '@udonarium/transform/region-overlap-detector';
import { GameCharacterTargetingService } from 'service/game-character-targeting.service';
import { BatchService } from 'service/batch.service';

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
    this._gameCharacter = option.gameCharacter ?? null;
  }
  @Input('targetable.disable') isDisable: boolean = false;
  @Output('targetable.onstart') onstart: EventEmitter<PointerEvent> = new EventEmitter();
  @Output('targetable.onend') onend: EventEmitter<PointerEvent> = new EventEmitter();

  get nativeElement(): HTMLElement { return this.elementRef.nativeElement; }

  private overlapDetector: RegionOverlapDetector;

  get state(): boolean { return this.targetingService.has(this.gameCharacter); }
  set state(state: boolean) {
    if (state) this.targetingService.add(this.gameCharacter);
    else this.targetingService.remove(this.gameCharacter);
  }

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
    if (this.isDisable && this.state !== false) this.state = false;
  }

  // ターゲット状態はコマの DOM より寿命が長い。外す条件は GameCharacterTargetingService が見る
  ngOnDestroy() {
    this.dispose();
  }

  initialize() {
    this.overlapDetector = new RegionOverlapDetector(this.nativeElement);
    this.addEventListeners();
  }

  destroy() {
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
    this.state = this.overlapDetector.checkOverlap(e.detail);
  }

  private toggleState() {
    this.state = !this.state;
  }

  private addEventListeners () {
    this.nativeElement.addEventListener('targetobject', this.callbackOnTargetObject);
    this.nativeElement.ownerDocument.addEventListener('targetregion', this.callbackOnTargetRegion);
  }

  private removeEventListeners () {
    this.nativeElement.removeEventListener('targetobject', this.callbackOnTargetObject);
    this.nativeElement.ownerDocument.removeEventListener('targetregion', this.callbackOnTargetRegion);
  }

}
