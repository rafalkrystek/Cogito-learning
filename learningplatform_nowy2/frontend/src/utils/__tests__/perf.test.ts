import { measureAsync } from '../perf';

describe('measureAsync', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    (global as any).sessionStorage = {
      store: {} as Record<string, string>,
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      },
    };
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  it('measures async function duration and returns result', async () => {
    const fn = jest.fn(async () => {
      return 42;
    });

    const result = await measureAsync('test-label', fn);

    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[PERF] test-label:')
    );
  });

  it('stores last measurement in sessionStorage', async () => {
    const fn = jest.fn(async () => {});

    await measureAsync('another-label', fn);

    const raw = (global as any).sessionStorage.getItem('perf_another-label');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.label).toBe('another-label');
    expect(typeof parsed.durationMs).toBe('number');
  });
});

