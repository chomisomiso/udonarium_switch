import { TargetableDirective } from './targetable.directive';

describe('TargetableDirective', () => {
  it('should create an instance', () => {
    const directive = new TargetableDirective(null, null, null);
    expect(directive).toBeTruthy();
  });
});
