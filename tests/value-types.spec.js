import Vault from '../dist/vault.js';
import EncryptedVault from '../dist/encrypted-vault.js';

function toArray(u8) {
  return Array.from(u8);
}

describe('Value types beyond strings', () => {
  let plain;
  let secure;

  beforeEach(async () => {
    plain = new Vault('value-types-plain');
    secure = new EncryptedVault({ password: 'pw', salt: 'salt' }, { storageName: 'value-types-secure' });
    await plain.clear();
    await secure.clear();
  });

  afterEach(async () => {
    await plain.clear();
    await secure.clear();
  });

  it('stores and retrieves typed arrays and ArrayBuffer (plain + encrypted)', async () => {
    const samples = [
      new Uint8Array([1,2,3,255]),
      new Int16Array([-1, 2, -3, 4]),
      new Float32Array([Math.PI, Math.E]),
    ];

    for (let i = 0; i < samples.length; i++) {
      const ta = samples[i];
      const ab = ta.buffer.slice(0);

      await plain.setItem(`ta-${i}`, ta);
      await plain.setItem(`ab-${i}`, ab);

      let gotTA = await plain.getItem(`ta-${i}`);
      let gotAB = await plain.getItem(`ab-${i}`);

      expect(gotTA.buffer.byteLength).toBe(ta.byteLength);
      expect(new Uint8Array(gotTA.buffer ?? gotTA).length > 0).toBeTrue();
      expect((gotAB instanceof ArrayBuffer)).toBeTrue();

      await secure.setItem(`ta-${i}`, ta);
      await secure.setItem(`ab-${i}`, ab);

      gotTA = await secure.getItem(`ta-${i}`);
      gotAB = await secure.getItem(`ab-${i}`);

      const gotTAu8 = gotTA.buffer ? new Uint8Array(gotTA.buffer) : new Uint8Array(gotTA);
      expect(toArray(gotTAu8)).toEqual(toArray(new Uint8Array(ta.buffer)));
      expect(gotAB instanceof ArrayBuffer).toBeTrue();
      expect(toArray(new Uint8Array(gotAB))).toEqual(toArray(new Uint8Array(ab)));
    }
  });

  it('stores and retrieves Blob/File (encrypted vault)', async () => {
    if (typeof Blob === 'undefined') return;
    const blob = new Blob([new Uint8Array([10,20,30,40])], { type: 'application/octet-stream' });

    await secure.setItem('blob', blob);
    const got = await secure.getItem('blob');
    expect(got instanceof Blob).toBeTrue();
    const text = await (async () => {
      const buf = await got.arrayBuffer();
      return Array.from(new Uint8Array(buf));
    })();
    expect(text).toEqual([10,20,30,40]);
  });

  it('stores and retrieves Map/Set/Date/RegExp/BigInt (encrypted vault)', async () => {
    const map = new Map([[1,'a'], ['b', 2]]);
    const set = new Set([1, 'x', true]);
    const date = new Date('2020-01-02T03:04:05.678Z');
    const re = /hello/gi;
    const big = (typeof BigInt !== 'undefined') ? BigInt('9007199254740993') : '9007199254740993';

    await secure.setItem('map', map);
    await secure.setItem('set', set);
    await secure.setItem('date', date);
    await secure.setItem('re', re);
    await secure.setItem('big', big);

    const gotMap = await secure.getItem('map');
    const gotSet = await secure.getItem('set');
    const gotDate = await secure.getItem('date');
    const gotRe = await secure.getItem('re');
    const gotBig = await secure.getItem('big');

    expect(gotMap instanceof Map).toBeTrue();
    expect(gotMap.get(1)).toBe('a');
    expect(gotMap.get('b')).toBe(2);

    expect(gotSet instanceof Set).toBeTrue();
    expect(gotSet.has(1)).toBeTrue();
    expect(gotSet.has('x')).toBeTrue();

    expect(gotDate instanceof Date).toBeTrue();
    expect(gotDate.toISOString()).toBe(date.toISOString());

    expect(gotRe instanceof RegExp).toBeTrue();
    expect(gotRe.source).toBe('hello');
    expect(gotRe.flags).toContain('g');
    expect(gotRe.flags).toContain('i');

    if (typeof BigInt !== 'undefined') {
      expect(typeof gotBig === 'bigint').toBeTrue();
      expect(gotBig.toString()).toBe('9007199254740993');
    } else {
      expect(gotBig).toBe('9007199254740993');
    }
  });
});
