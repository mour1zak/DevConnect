import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  it('should be defined', () => {
    expect(new PermissionsGuard(new Reflector())).toBeDefined();
  });
});
