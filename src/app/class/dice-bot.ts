import { Injectable } from '@angular/core';
import { GameSystemInfo } from 'bcdice/lib/bcdice/game_system_list.json';
import GameSystemClass from 'bcdice/lib/game_system';
import BCDiceLoader from './bcdice/bcdice-loader';
import { PromiseQueue } from './core/system/util/promise-queue';

export interface DiceRollResult {
  id: string;
  result: string;
  isSecret: boolean;
}

let loader: BCDiceLoader;
let queue: PromiseQueue;

let isInitialized = false;

@Injectable({
  providedIn: 'root'
})
export class DiceBot {
  private static diceBotInfos: GameSystemInfo[] = [];
  private static _type: string = 'DiceBot';
  static get type(): string {
    return this._type;
  }
  static set type(value: string) {
    this._type = value;
  }

  static async initialize(): Promise<void> {
    if (isInitialized) return;
    await this.initializeAsync();
    isInitialized = true;
  }

  private static async initializeAsync(): Promise<void> {
    queue = new PromiseQueue('DiceRollQueue');
    await queue.add(async () => {
      loader = new (await import(
        /* webpackChunkName: "lib/bcdice/bcdice-loader" */
        './bcdice/bcdice-loader')
      ).default;
      DiceBot.diceBotInfos = loader.listAvailableGameSystems()
        .sort((a, b) => {
          if (a.sortKey < b.sortKey) return -1;
          if (a.sortKey > b.sortKey) return 1;
          return 0;
        });
    });
  }

  private static async ensureInitialized(): Promise<void> {
    if (!isInitialized) {
      await this.initialize();
    }
  }

  static async diceRollAsync(message: string): Promise<DiceRollResult>;
  static async diceRollAsync(message: string, gameType: string): Promise<DiceRollResult>;
  static async diceRollAsync(message: string, gameType?: string): Promise<DiceRollResult> {
    await this.ensureInitialized();
    gameType = gameType ?? this._type;
    const empty: DiceRollResult = { id: gameType, result: '', isSecret: false };
    try {
      const gameSystem = await DiceBot.loadGameSystemAsync(gameType);
      if (!gameSystem?.COMMAND_PATTERN.test(message)) return empty;

      const result = gameSystem.eval(message);
      if (result) {
        console.log('diceRoll!!!', result.text);
        console.log('isSecret!!!', result.secret);
        return {
          id: gameSystem.ID,
          result: result.text.replace(/\n?(#\d+)\n/ig, '$1 '), // 繰り返しダイスロールは改行表示を短縮する
          isSecret: result.secret,
        };
      }
    } catch (e) {
      console.error(e);
    }
    return empty;
  }

  private static async loadGameSystemAsync(gameType: string): Promise<GameSystemClass> {
    return await queue.add(() => {
      const id = DiceBot.diceBotInfos.some(info => info.id === gameType) ? gameType : 'DiceBot';
      try {
        return loader.getGameSystemClass(id);
      } catch {
        return loader.dynamicLoad(id);
      }
    });
  }

  static async getHelpMessage(gameType: string): Promise<string> {
    await this.ensureInitialized();
    try {
      const gameSystem = await DiceBot.loadGameSystemAsync(gameType);
      return gameSystem.HELP_MESSAGE;
    } catch (e) {
      console.error(e);
    }
    return '';
  }

  static get infos(): GameSystemInfo[] {
    return this.diceBotInfos;
  }
}