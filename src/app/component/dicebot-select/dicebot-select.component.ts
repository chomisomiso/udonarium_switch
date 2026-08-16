import { Component, EventEmitter, Input, Output } from '@angular/core';

import { DiceBot } from '@udonarium/dice-bot';

@Component({
  selector: 'dicebot-select',
  templateUrl: './dicebot-select.component.html'
})
export class DiceBotSelectComponent {
  @Input('gameType') _gameType: string = '';
  @Output() gameTypeChange = new EventEmitter<string>();
  get gameType(): string { return this._gameType; }
  set gameType(gameType: string) { this._gameType = gameType; this.gameTypeChange.emit(gameType); }

  get diceBotInfos() { return DiceBot.infos }
}
