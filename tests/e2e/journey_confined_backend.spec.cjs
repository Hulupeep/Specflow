'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('fs'),crypto=require('crypto');
const publicConfig=JSON.parse(fs.readFileSync('/inputs/public.json'));
async function api(service,route,method='GET',body,token){
 const response=await fetch(`${publicConfig.url}/${service}/v1${route}`,{method,headers:{apikey:publicConfig.anonKey,'Content-Type':'application/json',Prefer:'return=representation',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 return {status:response.status,data:await response.json()};
}
async function user(){
 const email=`browser-${crypto.randomUUID()}@example.com`,password=crypto.randomBytes(24).toString('hex');
 expect((await api('auth','/signup','POST',{email,password})).status).toBe(200);
 const session=await api('auth','/token?grant_type=password','POST',{email,password});expect(session.status).toBe(200);
 const claims=JSON.parse(Buffer.from(session.data.access_token.split('.')[1],'base64url'));expect(claims.role).toBe('authenticated');
 return {email,password,id:session.data.user.id,token:session.data.access_token};
}
async function login(page,account){
 const network=[];page.__qualificationNetwork=network;
 page.on('pageerror',error=>network.push({event:'pageerror',message:error.message.slice(0,1000)}));
 page.on('response',async r=>{if(new URL(r.url()).pathname.startsWith('/rest/v1')&&r.status()>=400){let error;try{const j=await r.json();error={code:j.code,message:j.message};}catch{}network.push({event:'rest-error',status:r.status(),path:new URL(r.url()).pathname,error});}});
 page.on('requestfailed',r=>{if(new URL(r.url()).pathname.startsWith('/rest/v1'))network.push({event:'rest-failed',path:new URL(r.url()).pathname,failure:r.failure()?.errorText});});

 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/auth/v1'))network.push({event:'request',method:r.method(),path:new URL(r.url()).pathname,headerNames:Object.keys(r.headers())});});
 page.on('requestfailed',r=>{if(new URL(r.url()).pathname.startsWith('/auth/v1'))network.push({event:'failed',method:r.method(),path:new URL(r.url()).pathname,failure:r.failure()?.errorText});});
 page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/auth/v1'))network.push({event:'response',status:r.status(),path:new URL(r.url()).pathname,allowOrigin:r.headers()['access-control-allow-origin'],allowHeaders:r.headers()['access-control-allow-headers']});});

 await page.addInitScript(()=>localStorage.setItem('tabstax.attention.tour',JSON.stringify({completed:true,completedAt:null,dismissedAtStep:null,version:'v2'})));
 await page.goto('http://127.0.0.1:3000/attention');
 await expect(page.getByTestId('login-form')).toBeVisible({timeout:20000});
 await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);
 await page.getByTestId('login-form').locator('button[type="submit"]').click();
 await expect(page.getByRole('heading',{name:'Choose your handle',exact:true})).toBeVisible({timeout:20000});
 await page.getByRole('textbox').fill('proof_'+crypto.randomBytes(5).toString('hex'));await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Choose your handle',exact:true})).toHaveCount(0,{timeout:20000});
 try { await expect(page.getByTestId('attention-board')).toBeVisible({timeout:20000}); } catch(error) {
   const authText=await page.getByTestId('auth-error').count()?await page.getByTestId('auth-error').textContent():null;
   console.log(JSON.stringify({diagnostic:'browser-login-failed',authText,network}));
   fs.writeFileSync(test.info().outputPath('login-body.txt'),await page.locator('body').innerText());await page.screenshot({path:test.info().outputPath('login-failed.png'),fullPage:true,timeout:5000});throw error;
 }
}
for(const width of [1280,360])test(`J-BACKEND-PRODUCT-${width}: real login save reload and wrong-user RLS rejection`,async({browser},info)=>{
 const owner=await user(),other=await user(),title=`Isolated project ${width}`;
 const created=await api('rest','/stax','POST',{user_id:owner.id,name:title,goals:[]},owner.token);expect(created.status).toBe(201);expect(created.data).toHaveLength(1);const id=created.data[0].id;
 const block=await api('rest','/attention_blocks','POST',{user_id:owner.id,stax_id:id,title,priority:'must',source:'manual'},owner.token);expect(block.status).toBe(201);
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
 const otherContext=await browser.newContext({viewport:{width,height:900}}),otherPage=await otherContext.newPage();
 try{
  await login(page,owner);
  await page.screenshot({path:info.outputPath('board-before-card.png'),fullPage:true});fs.writeFileSync(info.outputPath('board-body.txt'),await page.locator('body').innerText());
  const card=page.getByTestId('block-card').filter({hasText:title});await expect(card).toHaveCount(1);
  const saved=`Verified action persistence at ${width}px`;
  const input=card.getByTestId('add-action-input');
  if(!await input.isVisible())await card.getByTestId('add-action-button').click();
  await expect(input).toBeVisible();await input.fill(saved);
  const responsePromise=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/next-actions');
  await input.press('Enter');const response=await responsePromise;const responseText=await response.text();let payload;try{payload=JSON.parse(responseText);}catch{payload={error:responseText.slice(0,500)};}
  console.log(JSON.stringify({diagnostic:'next-action-create',width,status:response.status(),error:payload.error??null,actionReturned:Boolean(payload.action)}));
  expect(response.status()).toBe(201);
  await expect(card.getByTestId('next-action-item').filter({hasText:saved})).toBeVisible();
  const route=`/next_actions?stax_id=eq.${id}`;
  const before=await api('rest',route,'GET',undefined,owner.token);expect(before.status).toBe(200);expect(before.data).toHaveLength(1);expect(before.data[0].content).toBe(saved);
  await page.reload();await expect(page.getByTestId('attention-board')).toBeVisible({timeout:20000});
  await expect(page.getByTestId('block-card').filter({hasText:title}).getByTestId('next-action-item').filter({hasText:saved})).toBeVisible();
  await page.screenshot({path:info.outputPath(`saved-action-${width}.png`),fullPage:true});
  await login(otherPage,other);await expect(otherPage.getByTestId('block-card').filter({hasText:title})).toHaveCount(0);
  const otherRead=await api('rest',route,'GET',undefined,other.token);expect(otherRead.status).toBe(200);expect(otherRead.data).toEqual([]);
  const otherPatch=await api('rest',route,'PATCH',{content:'Forbidden replacement'},other.token);expect(otherPatch.status).toBe(200);expect(otherPatch.data).toEqual([]);
  // Real second-user bearer replaces one create request; server/backend answer is never mocked.
  let injected=0;
  await page.route('**/api/next-actions',async r=>{if(r.request().method()==='POST'){injected++;await r.continue({headers:{...r.request().headers(),authorization:`Bearer ${other.token}`}});}else await r.continue();});
  const currentCard=page.getByTestId('block-card').filter({hasText:title});const currentInput=currentCard.getByTestId('add-action-input');
  if(!await currentInput.isVisible())await currentCard.getByTestId('add-action-button').click();
  await currentInput.fill(`Denied action ${width}`);
  const deniedPromise=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/next-actions');await currentInput.press('Enter');
  const denied=await deniedPromise;expect([403,404]).toContain(denied.status());expect(injected).toBe(1);
  const deniedBody=await denied.json();expect(typeof deniedBody.error).toBe('string');await expect(page.getByText(deniedBody.error,{exact:true})).toBeVisible();
  const after=await api('rest',route,'GET',undefined,owner.token);expect(after.status).toBe(200);expect(after.data).toEqual(before.data);
  await page.screenshot({path:info.outputPath(`denied-action-${width}.png`),fullPage:true});
 }catch(error){console.log(JSON.stringify({diagnostic:"journey-failed",network:page.__qualificationNetwork}));try{await page.screenshot({path:info.outputPath('journey-failed.png'),fullPage:true,timeout:5000});fs.writeFileSync(info.outputPath('failure-body.txt'),await page.locator('body').innerText());}catch{}throw error;}finally{await otherContext.close();await context.close();}
});
