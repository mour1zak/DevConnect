import { ApiKeyGuard } from './guard.service';

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard();

  const contextWith = (apiKey?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: apiKey ? { 'x-api-key': apiKey } : {} }),
      }),
    }) as any;

  beforeAll(() => {
    process.env.APIKEY = 'test-key';
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('libera quando a x-api-key é válida', () => {
    expect(guard.canActivate(contextWith('test-key'))).toBe(true);
  });

  it('bloqueia quando a x-api-key está ausente', () => {
    expect(guard.canActivate(contextWith())).toBe(false);
  });

  it('bloqueia quando a x-api-key está incorreta', () => {
    expect(guard.canActivate(contextWith('errada'))).toBe(false);
  });
});
