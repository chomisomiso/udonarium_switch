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
    this.unregister();

    this._gameCharacter = option.gameCharacter ?? null;

    this.register();
  }
  @Input('targetable.disable') isDisable: boolean = false;
  @Output('targetable.onstart') onstart: EventEmitter<PointerEvent> = new EventEmitter();
  @Output('targetable.onend') onend: EventEmitter<PointerEvent> = new EventEmitter();

  get nativeElement(): HTMLElement { return this.elementRef.nativeElement; }

  private overlapDetector: RegionOverlapDetector;

  get state(): boolean { return this.targetingService.getState(this.gameCharacter); }
  set state(state: boolean) { this.targetingService.add(this.gameCharacter, state); }

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

  ngOnDestroy() {
    this.unregister();
    this.dispose();
  }

  initialize() {
    this.overlapDetector = new RegionOverlapDetector(this.nativeElement);
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

  private register() {
    this.targetingService.add(this.gameCharacter, this.state);
  }

  private unregister() {
    this.targetingService.remove(this.gameCharacter);
  }
}
