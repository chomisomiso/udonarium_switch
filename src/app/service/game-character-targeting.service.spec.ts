import { TestBed } from '@angular/core/testing';

import { GameCharacterTargetingService } from './game-character-targeting.service';

describe('TabletopSelectionService', () => {
  let service: GameCharacterTargetingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameCharacterTargetingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
