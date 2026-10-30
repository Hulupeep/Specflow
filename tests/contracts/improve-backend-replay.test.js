const {assertReplayWindow}=require('../qualification/improve-backend-generation.test.cjs');
const token=claims=>'header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
describe('replay evidence distinguishes rotation from expiry (#293)',()=>{
 const now=1700000000000;
 test('an unexpired prior token has time for all three actual HTTP controls',()=>{
  expect(()=>assertReplayWindow(token({exp:now/1000+31}),now)).not.toThrow();
 });
 test.each([-1,0,30])('expired or insufficiently live prior token is not revocation proof: %s seconds',seconds=>{
  expect(()=>assertReplayWindow(token({exp:now/1000+seconds}),now)).toThrow('replay_requires_unexpired_prior_token');
 });
 test.each([{}, {exp:'1700001000'}, {exp:1700001000.5}])('malformed expiry case %# fails closed without token contents',claims=>{
  expect(()=>assertReplayWindow(token(claims),now)).toThrow('replay_requires_unexpired_prior_token');
 });
 test('malformed token fails with a fixed diagnostic',()=>{
  expect(()=>assertReplayWindow('invalid',now)).toThrow('replay_requires_unexpired_prior_token');
 });
});
