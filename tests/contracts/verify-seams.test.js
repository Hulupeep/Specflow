/**
 * verify-seams.cjs — seam-lite computation (#61).
 * Oracle: the timebreez #673 collisions — #681 & #686 both write /my-leave (writer×writer);
 * a reader on a written surface is a writer×reader seam; an isolated surface is no seam.
 */

const { computeSeams } = require('../../scripts/verify-seams.cjs');

describe('computeSeams', () => {
  test('writer×writer: two slices writing one surface is a seam naming both', () => {
    const { seams } = computeSeams([
      { id: '681', writes: ['/my-leave'] },
      { id: '686', writes: ['/my-leave'] },
    ]);
    expect(seams).toHaveLength(1);
    expect(seams[0].surface).toBe('/my-leave');
    expect(seams[0].kind).toBe('writer-writer');
    expect(seams[0].pairs).toEqual([['681', '686']]);
  });

  test('writer×reader: a reader on a written surface is a seam (rename/shape break)', () => {
    const { seams } = computeSeams([
      { id: '685', writes: ['data-balance-card'] },
      { id: '687', reads: ['data-balance-card'] },
    ]);
    expect(seams).toHaveLength(1);
    expect(seams[0].kind).toBe('writer-reader');
    expect(seams[0].pairs).toEqual([['685', '687']]);
  });

  test('no seam: a surface only one slice touches', () => {
    const { seams } = computeSeams([
      { id: '683', writes: ['/presence'] },
      { id: '684', writes: ['/settings'] },
    ]);
    expect(seams).toHaveLength(0);
  });

  test('reader-only surface (no writer) is NOT a seam — nothing can break it', () => {
    const { seams } = computeSeams([
      { id: 'a', reads: ['/dashboard'] },
      { id: 'b', reads: ['/dashboard'] },
    ]);
    expect(seams).toHaveLength(0);
  });

  test('derived hops: one per seam, asserting a re-read value', () => {
    const { derivedHops } = computeSeams([
      { id: '681', writes: ['/my-leave'] },
      { id: '686', writes: ['/my-leave'], reads: ['/dashboard'] },
      { id: '685', writes: ['/dashboard'] },
    ]);
    const surfaces = derivedHops.map(h => h.surface).sort();
    expect(surfaces).toEqual(['/dashboard', '/my-leave']);
    expect(derivedHops.every(h => /re-read value/.test(h.assert))).toBe(true);
  });

  test('mixed: 2 writers + a reader on one surface enumerates all pairs', () => {
    const { seams } = computeSeams([
      { id: 'w1', writes: ['/x'] },
      { id: 'w2', writes: ['/x'] },
      { id: 'r1', reads: ['/x'] },
    ]);
    expect(seams[0].kind).toBe('mixed');
    expect(seams[0].pairs.sort()).toEqual([['w1', 'r1'], ['w1', 'w2'], ['w2', 'r1']].sort());
  });
});
