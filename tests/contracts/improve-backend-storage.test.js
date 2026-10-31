'use strict';
const storage=require('../../scripts/improve-backend-storage.cjs');
const header='Filesystem 1024-blocks Used Available Capacity Mounted on\n';
describe('closed backend storage observations',()=>{
 test('reports actual remaining capacity and a full mount independently',()=>{
  expect(storage.parse('gateway',header+'tmpfs 32768 1024 31744 4% /work\ntmpfs 16384 16384 0 100% /tmp\n')).toEqual([
   {mount:'/work',totalBlocks:32768,availableBlocks:31744},{mount:'/tmp',totalBlocks:16384,availableBlocks:0}
  ]);
 });
 test('does not infer full storage from a rounded 100% display',()=>{
  expect(storage.parse('database',header+'tmpfs 262144 262143 1 100% /work')[0].availableBlocks).toBe(1);
 });
 test.each([
  '',header,header+'tmpfs 10 10 0 100% /foreign',header+'overlay 10 10 0 100% /work',
  header+'tmpfs 10 9 2 90% /work',header+'tmpfs 10 -1 11 0% /work',
  header+'tmpfs 9007199254740992 0 9007199254740992 0% /work',
  header+'tmpfs 10 5 NaN 50% /work',header+'tmpfs 10 5 5 50% /work\ntmpfs 10 5 5 50% /work'
 ])('rejects missing, ambiguous or malformed observation %j',text=>{
  expect(()=>storage.parse('database',text)).toThrow('backend_readiness_failed');
 });
 test('gateway requires both known mounts, regardless of order',()=>{
  expect(()=>storage.parse('gateway',header+'tmpfs 10 5 5 50% /tmp')).toThrow('backend_readiness_failed');
  expect(storage.parse('gateway',header+'tmpfs 10 5 5 50% /tmp\ntmpfs 20 5 15 25% /work')).toHaveLength(2);
 });
 test('caller cannot extend the closed path set or mutate subsequent observations',()=>{
  storage.mounts('database').push('/host');
  expect(storage.mounts('database')).toEqual(['/work']);
  expect(storage.mounts('checker')).toEqual([]);
  expect(()=>storage.parse('checker',header)).toThrow('backend_readiness_failed');
 });
});
