'use strict';
const fs=require('fs'),path=require('path');
const ws=process.env.IMPROVE_WORKSPACE||'/home/xanacan/projects/code/heystax-improve-180-source';
const {test,expect}=require(path.join(ws,'node_modules/@playwright/test'));
const {createClient}=require(path.join(ws,'node_modules/@supabase/supabase-js'));
const fixture=JSON.parse(fs.readFileSync('/home/xanacan/.local/state/specflow-improve/180-backend/fixture-private.json'));
const base=process.env.BASE_URL||'http://127.0.0.1:62181';
test.setTimeout(120000);
async function login(page,user){
 await page.route('**/*',route=>{const u=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol)?route.continue():route.abort();});
 await page.goto(base+'/attention');await page.locator('input[type=email]').fill(user.email);await page.locator('input[type=password]').fill(user.password);await page.locator('button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('button[aria-label="Menu"]')||Array.from(document.querySelectorAll('h1')).some(e=>e.textContent.includes('Choose your handle')));
 if(await page.getByRole('heading',{name:'Choose your handle',exact:true}).isVisible()){
  await page.locator('input[type=text]').fill('sf180_'+user.id.replace(/-/g,'').slice(0,10));await page.getByRole('button',{name:'Continue',exact:true}).click();
 }
 await page.getByRole('button',{name:'Menu',exact:true}).waitFor();await page.waitForTimeout(1200);
 const close=page.getByRole('button',{name:'Close tour',exact:true});if(await close.isVisible())await close.click();
}
for(const width of [1280,360,390,768])test(`J-IMPROVE-HEYSTAX-BACKEND practice responsive ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await login(page,fixture.users[0]);
 await expect(page.getByText('Improve proof: resume this project',{exact:true}).first()).toBeVisible();
 const rects=await page.evaluate(()=>{const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,menu:box(document.querySelector('button[aria-label="Menu"]')),today:box(document.querySelector('[data-testid="nav-today"]')),brand:box(document.querySelector('header h1'))}});
 fs.writeFileSync(info.outputPath('measurements.json'),JSON.stringify(rects,null,2));await page.screenshot({path:info.outputPath('board.png'),fullPage:true});
 expect.soft(rects.scrollWidth).toBeLessThanOrEqual(width+1);for(const r of [rects.menu,rects.today]){expect.soft(r.x).toBeGreaterThanOrEqual(0);expect.soft(r.right).toBeLessThanOrEqual(width+1);expect.soft(r.height).toBeGreaterThanOrEqual(32);}
 const overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
 expect.soft(overlap(rects.menu,rects.today)).toBe(false);expect.soft(overlap(rects.menu,rects.brand)).toBe(false);expect.soft(overlap(rects.today,rects.brand)).toBe(false);
 // Click action is deliberately after geometric assertions; Playwright must not conceal a problem by scrolling first.
 await page.getByRole('button',{name:'Menu',exact:true}).click();await expect(page.getByRole('link',{name:'Manage Attention',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('menu.png'),fullPage:true});
 for(const label of ['Manage Attention','Today','Live Stax','Timesheets','Billing','Agents','Account Records','MCP Settings'])await expect(page.locator('nav').getByRole('link',{name:label,exact:true})).toBeVisible();
 await page.locator('nav').getByRole('link',{name:'Today',exact:true}).click();await expect(page).toHaveURL(/\/today/);
 await page.goto(base+'/attention');await expect(page.getByText('Improve proof: resume this project',{exact:true}).first()).toBeVisible();
});
test('J-IMPROVE-HEYSTAX-BACKEND real persistence and denied write',async({page,browser},info)=>{
 await login(page,fixture.users[0]);await page.goto(base+'/stax/'+fixture.staxId);
 await expect(page.getByRole('heading',{name:'Improve proof: resume this project',exact:true})).toBeVisible();
 const content='Resume the local Improve proof';await page.getByPlaceholder('Add next action…').fill(content);await page.getByRole('button',{name:'Add',exact:true}).click();
 await expect(page.getByText(content,{exact:true})).toBeVisible();await page.reload();await expect(page.getByText(content,{exact:true})).toBeVisible();
 const owner=createClient(fixture.apiUrl,fixture.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});const auth=await owner.auth.signInWithPassword({email:fixture.users[0].email,password:fixture.users[0].password});expect(auth.error).toBeNull();
 const before=await owner.from('next_actions').select('id,content,done').eq('stax_id',fixture.staxId).order('id');expect(before.error).toBeNull();expect(before.data.filter(x=>x.content===content)).toHaveLength(1);
 await page.screenshot({path:info.outputPath('persisted.png'),fullPage:true});
 const otherContext=await browser.newContext({viewport:{width:360,height:900}});try{
  const other=await otherContext.newPage();await login(other,fixture.users[1]);await other.goto(base+'/stax/'+fixture.staxId);await expect(other.getByText('No next actions yet.',{exact:true})).toBeVisible();await expect(other.getByRole('heading',{name:'Improve proof: resume this project',exact:true})).toHaveCount(0);await expect(other.getByText(content,{exact:true})).toHaveCount(0);
  await other.getByPlaceholder('Add next action…').fill('Unauthorised local proof write');const pending=other.waitForResponse(r=>r.url().endsWith('/api/next-actions')&&r.request().method()==='POST');await other.getByRole('button',{name:'Add',exact:true}).click();expect((await pending).status()).toBe(403);await expect(other.getByText('Forbidden',{exact:true})).toBeVisible();await other.screenshot({path:info.outputPath('denied.png'),fullPage:true});
  const after=await owner.from('next_actions').select('id,content,done').eq('stax_id',fixture.staxId).order('id');expect(after.error).toBeNull();expect(after.data).toEqual(before.data);
  const denied=createClient(fixture.apiUrl,fixture.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});expect((await denied.auth.signInWithPassword({email:fixture.users[1].email,password:fixture.users[1].password})).error).toBeNull();expect((await denied.from('stax').select('id').eq('id',fixture.staxId)).data).toEqual([]);expect((await denied.from('next_actions').select('id').eq('stax_id',fixture.staxId)).data).toEqual([]);
  fs.writeFileSync(info.outputPath('backend-summary.json'),JSON.stringify({authenticated:true,persisted:before.data.length,deniedStatus:403,unchanged:true}));
 }finally{await otherContext.close();}
});
