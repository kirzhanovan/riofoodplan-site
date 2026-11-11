(async()=>{
 const kind=location.pathname.startsWith('/r/')?'recipe':'list';
 const token=location.pathname.split('/').filter(Boolean).at(-1);
 const root=document.querySelector('main');
 const appStore='https://apps.apple.com/app/id6791933098';
 // «Open in Rio»: in-app browsers (Instagram, Telegram) never hand a universal link to the app, and
 // Safari never does for a link back to riofoodplan.com itself, so the button uses the app's own
 // scheme. iOS must register the scheme and route riofoodplan://r/<token> (block B, not in this file).
 // Then (review 08.11.2026): the page hid (pagehide, visibilitychange → hidden) → Rio opened, nothing more.
 // Nothing at all for 2.5 s → Rio is not installed: the App Store. A blur (Safari's «Open in Rio?» question,
 // or its «address is invalid» alert) pauses that: when focus comes back and the page is still in front,
 // the App Store 1 s later if the page still has focus (the person said no, or Rio is not installed); a slow
 // launch after «Open» hides the page within that second (re-review 08.11.2026 п.6).
 const appScheme='riofoodplan';
 let attempt=null,watching=false;
 function toStore(a){if(a!==attempt||a.done||a.hidden||document.hidden||document.hasFocus?.()===false)return;a.done=true;location.href=appStore;}
 function watch(){
  if(watching)return;watching=true;
  const hide=()=>{if(attempt){attempt.hidden=true;clearTimeout(attempt.timer);}};
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden)hide();});
  globalThis.addEventListener?.('pagehide',hide);
  globalThis.addEventListener?.('blur',()=>{const a=attempt;if(!a||a.done||a.hidden)return;a.blurred=true;clearTimeout(a.timer);});
  globalThis.addEventListener?.('focus',()=>{const a=attempt;if(!a||!a.blurred||a.done||a.hidden||document.hidden)return;a.blurred=false;clearTimeout(a.timer);a.timer=setTimeout(()=>toStore(a),1000);});
 }
 function openInRio(event){
  if(!/^[a-f0-9]{48}$/.test(token??''))return;
  event?.preventDefault?.();watch();
  if(attempt)clearTimeout(attempt.timer);
  const a=attempt={hidden:false,blurred:false,done:false,timer:null};
  location.href=appScheme+'://r/'+token;
  a.timer=setTimeout(()=>{if(!a.blurred)toStore(a);},2500);
 }
 function wireOpen(button){if(button&&kind==='recipe')button.addEventListener('click',openInRio);}
 // The Worker renders the recipe on the server: only wire the button.
 if(root?.dataset?.rendered==='recipe'){wireOpen(document.querySelector('#open-in-rio'));return;}
 if(!/^[a-f0-9]{48}$/.test(token??'')){root.textContent='Link not found.';return;}
 // The static page: the Smart App Banner's «Open» hands Rio this page's address, as on the rendered page
 // (Safari may read the banner before this runs; then it opens Rio without the address).
 if(kind==='recipe'){const banner=document.querySelector?.('meta[name="apple-itunes-app"]');if(banner)banner.setAttribute('content','app-id=6791933098, app-argument=https://riofoodplan.com/r/'+token);}
 const bootstrap=document.querySelector('#shared-bootstrap');
 const initial=bootstrap?JSON.parse(bootstrap.textContent):null;
 const endpoint=initial?.endpoint??('https://ctewtltiwdhjbgcushzu.supabase.co/functions/v1/'+(kind==='recipe'?'share-page':'share-list')+'?token='+token);
 const jsonEndpoint=endpoint+(endpoint.includes('?')?'&':'?')+'format=json';
 // Amounts as in the app (Swift RecipeQuantity); the same code as quantityText() in
 // supabase/functions/_shared/recipe-sharing.ts (the worker test compares the two on the same lines).
 const countWords=new Set(['clove','stalk','bunch','leaf','can','head','slice','sprig','fillet','pod','spear','floret','handful','ear','sheet','cube','stick','packet','jar','bulb']);
 const knownUnits=new Set(['g','kg','ml','l','oz','lb','tsp','tbsp','cup','piece','pinch','to_taste','unknown']);
 const fluidOunceWords=new Set(['fl oz','fl. oz','fl_oz','floz','fluid ounce','fluid ounces']);
 const kitchenUnits=new Set(['tsp','tbsp','cup','oz','lb','piece']);
 const glyphs=[[1/8,'⅛'],[1/4,'¼'],[1/3,'⅓'],[3/8,'⅜'],[1/2,'½'],[5/8,'⅝'],[2/3,'⅔'],[3/4,'¾'],[7/8,'⅞']];
 function normalizedWord(raw){const w=raw.trim().toLowerCase();if(w==='leaves')return 'leaf';if(w.endsWith('es')&&countWords.has(w.slice(0,-2)))return w.slice(0,-2);if(w.endsWith('s')&&countWords.has(w.slice(0,-1)))return w.slice(0,-1);return w;}
 function wireUnit(raw){const w=normalizedWord(raw);if(knownUnits.has(w))return w;if(w==='to taste')return 'to_taste';if(countWords.has(w)||w==='pieces')return 'piece';return 'unknown';}
 function kitchenFraction(value){if(!Number.isFinite(value)||value<=0)return null;const whole=Math.floor(value),part=value-whole;if(part<=0.001||part>=0.999)return null;const g=glyphs.find(([v])=>Math.abs(v-part)<0.01);if(!g)return null;return whole===0?g[1]:whole+g[1];}
 const plainNumber=new Intl.NumberFormat('en-US',{maximumFractionDigits:2,roundingMode:'halfEven'});
 function quantity(raw){
  if(!raw||typeof raw!=='object'||typeof raw.lower!=='number'||!Number.isFinite(raw.lower))return '';
  let lower=raw.lower,upper=typeof raw.upper==='number'&&Number.isFinite(raw.upper)?raw.upper:null,unitText=typeof raw.unit_text==='string'?raw.unit_text:null,unit;
  const wire=typeof raw.unit==='string'?raw.unit:'unknown',word=normalizedWord(wire);
  if(fluidOunceWords.has(word)){lower*=29.5735295625;upper=upper==null?null:upper*29.5735295625;unit='ml';}
  else{unit=wireUnit(wire);if(unitText==null&&!knownUnits.has(word)&&word!=='to taste'&&word!=='pieces'&&word!=='')unitText=word;}
  if(unit==='to_taste')return 'To taste';
  // As the app shows metric: 1000 g and more in kg, 1000 ml and more in l.
  if(unit==='g'&&lower>=1000){lower/=1000;upper=upper==null?null:upper/1000;unit='kg';}
  if(unit==='ml'&&lower>=1000){lower/=1000;upper=upper==null?null:upper/1000;unit='l';}
  if((unit==='g'||unit==='ml')&&lower>=10){lower=Math.round(lower);upper=upper==null?null:Math.round(upper);}
  const amount=upper??lower,text=unitText?.trim()??'';let label;
  if(!text||!(unit==='piece'||unit==='unknown'))label=unit==='piece'?(amount<=1?'piece':'pieces'):unit==='unknown'?'':unit;
  else if(!(amount>1)||text.endsWith('s'))label=text;
  else label=text==='leaf'?'leaves':/(ch|sh|x)$/.test(text)?text+'es':text+'s';
  const number=v=>(kitchenUnits.has(unit)?kitchenFraction(v):null)??plainNumber.format(v);
  return number(lower)+(upper!=null?'–'+number(upper):'')+(label?' '+label:'');
 }
 const categories={main:'Main',mains:'Main',soup:'Soup',soups:'Soup',salad:'Salad',salads:'Salad',side:'Side',sides:'Side',porridge:'Porridge & cereal','porridge & cereal':'Porridge & cereal',baking:'Baking',dessert:'Dessert',desserts:'Dessert',snack:'Snack',snacks:'Snack',drink:'Drink',drinks:'Drink',sauce:'Sauces & dips','sauces & dips':'Sauces & dips'};
 function metaLine(d){const m=Number(d.total_minutes),s=Number(d.base_servings),c=typeof d.category==='string'?d.category.trim():'';return [Number.isFinite(m)&&m>0?m+' min':null,Number.isFinite(s)&&s>0?Number(s.toFixed(2))+(Number(s.toFixed(2))===1?' serving':' servings'):null,c?(categories[c.toLowerCase()]??c):null].filter(Boolean).join(' · ');}
 // The source line and the photo follow the source address and the author whatever the kind (an imported
 // recipe turns `adapted` after a swap); never a catalog recipe. Same rules as recipe-sharing.ts.
 function sourceURL(d){const s=d.source;if(!s||typeof s!=='object'||s.kind==='catalog')return null;try{const u=new URL(String(s.url??''));return ['https:','http:'].includes(u.protocol)?u:null;}catch{return null;}}
 function isInstagram(u){const h=u?.hostname.toLowerCase()??'';return h==='instagram.com'||h.endsWith('.instagram.com')||h==='instagr.am'||h==='www.instagr.am';}
 // The photo rule (same as recipeHTML; since audit V10 only Rio's public Storage, below): never a raw address on
 // Instagram's or Facebook's own hosts (signed, it expires) or a signed Storage URL. An Instagram recipe shows its
 // photo (owner 09.11.2026).
 function instagramImage(v){try{const u=new URL(String(v)),h=u.hostname.toLowerCase();return ['cdninstagram.com','fbcdn.net','fbsbx.com','instagram.com','instagr.am'].some(x=>h===x||h.endsWith('.'+x))||u.pathname.toLowerCase().includes('/storage/v1/object/sign/');}catch{return false;}}
 // Audit 10.11.2026 V10/V11, same as isRioPublicImage and authorText in recipe-sharing.ts: a photo only from Rio's
 // own public Storage; the author is plain text (no control, bidi or zero-width characters), at most 80 characters.
 const rioStorage='https://ctewtltiwdhjbgcushzu.supabase.co';
 function rioPublicImage(v){try{const u=new URL(String(v));return u.origin===rioStorage&&!u.username&&!u.password&&u.pathname.startsWith('/storage/v1/object/public/');}catch{return false;}}
 function authorText(v){if(typeof v!=='string')return '';const clean=v.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,' ').replace(/\s+/g,' ').trim(),chars=[...clean];return chars.length>80?chars.slice(0,79).join('').trimEnd()+'…':clean;}
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
 function listDay(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;const [y,m,d]=v.split('-').map(Number);return m>=1&&m<=12&&d>=1&&d<=31?{y,m,d}:null;}
 function listSubtitle(data){const a=listDay(data.period_start),b=listDay(data.period_end);if(!a||!b)return data.week_start;if(a.y===b.y&&a.m===b.m&&a.d===b.d)return a.d+' '+monthNames[a.m-1];return a.y===b.y&&a.m===b.m?a.d+'–'+b.d+' '+monthNames[b.m-1]:a.d+' '+monthNames[a.m-1]+' – '+b.d+' '+monthNames[b.m-1];}
 function add(tag,text,parent=root,className){const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;parent.append(e);return e;}
 try{
  let data=initial?.row;
  if(!data){const response=await fetch(jsonEndpoint,{cache:'no-store'});if(!response.ok)throw Error();data=await response.json();}
  root.textContent='';
  if(kind==='recipe'){
   const d=data.document??{},title=String(data.title??d.title??''),src=sourceURL(d);document.title=title+' · Rio';
   // Owner 09.11.2026: an Instagram recipe shows its photo too.
   const raw=data.image_url??d.image_url??'',photo=instagramImage(raw)||!rioPublicImage(raw)?'':new URL(String(raw)).href;
   if(/^https:\/\//.test(photo)){const image=add('img','',root,'hero');image.src=photo;image.alt='';}
   else{const ph=add('div','',root,'hero ph');ph.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h3.2l1.8-2.5h6l1.8 2.5H20v10.5H4z"/><circle cx="12" cy="13.3" r="3.2"/></svg>';}
   const head=add('div','',root,'head');add('h1',title,head);
   // «Recipe by Jane Cook (@cook.jane) on Instagram» (approved 07.11.2026); a site import uses the
   // domain instead (COPY: not approved). The name links to the post only over https.
   const author=authorText(d.source?.author);
   if(author&&src){src.username='';src.password='';
    const by=add('p','Recipe by ',head,'by');
    if(src.protocol==='https:'){const a=add('a',author,by);a.href=src.href;a.rel='nofollow noopener';}else by.append(document.createTextNode(author));
    by.append(document.createTextNode(' on '+(isInstagram(src)?'Instagram':src.hostname.toLowerCase().replace(/^www\./,''))));
   }
   const meta=metaLine(d);if(meta)add('p',meta,head,'meta');
   // Approved 07.–08.11.2026 (frame 12).
   const fit=add('section','',root,'fit');add('h2','Make this recipe fit your food intolerances',fit);add('p','Open it in the Rio app to see which ingredients may not suit you and swap them.',fit);
   const open=add('a','Open in Rio',fit,'btn');open.id='open-in-rio';open.href=appStore;wireOpen(open);
   add('p','If you have just installed Rio, the recipe opens in the app when you tap this link again.',fit,'hint'); // COPY: owner 08.11.2026
   const ing=add('section','',root,'sec');add('h2','Ingredients',ing);let group='';
   for(const line of (Array.isArray(d.ingredients)?d.ingredients:[]).filter(l=>l&&l.is_active!==false&&l.kind!=='addition')){
    if(line.group&&line.group!==group)add('h3',line.group,ing);group=line.group??'';
    const row=add('div','',ing,'li');add('span',line.name??'',row);const q=quantity(line.quantity);if(q)add('span',q,row,'q');
   }
   const steps=Array.isArray(d.steps)?d.steps:[];
   if(steps.length){const method=add('section','',root,'sec');add('h2','Method',method);const ol=add('ol','',method,'steps');steps.forEach((s,i)=>{const li=add('li','',ol);const n=add('span',String(i+1),li,'n');n.setAttribute('aria-hidden','true');add('p',s?.text??'',li);});}
  }else if(data.kind==='week'){const head=add('div','',root,'head');add('h1','Planner',head);add('p',data.week_start,head,'sub');const sec=add('div','',root,'sec');data.items.forEach(e=>{const s=add('section','',sec);add('h2',typeof e.date==='string'?e.date:'',s);add('p',[e.slot_name,e.title,e.servings!=null?e.servings+(e.servings===1?' serving':' servings'):null].filter(Boolean).join(' · '),s);});}
  else{
   // Owner 10.11.2026 (S8): a link shared for a period names its days, as the app and recipe-sharing.ts
   // (sharedListSubtitle) do; a link without a period keeps its week start.
   const head=add('div','',root,'head');add('h1','Shopping',head);add('p',listSubtitle(data),head,'sub');
   // Owner 11.11.2026: the list no longer updates because the owner's Rio Plus access ended (owner_active ===
   // false; a row without the key shows nothing). The same line as sharedListStoppedLine in recipe-sharing.ts.
   const stopped=document.createElement('p');stopped.className='sub note';
   stopped.textContent='This list is no longer updated. If this is your list, check your Rio Plus subscription in the app.'; // COPY: owner-approved 11.11.2026
   const showStopped=row=>{if(row?.owner_active===false)head.append(stopped);else stopped.remove();};
   showStopped(data);
   const sec=add('div','',root,'sec'),list=add('div','',sec),status=add('p','',sec);status.setAttribute('role','status');
   const rows=new Map(),pending=new Set();let writeEpoch=0,polling=false;
   function reconcile(items){
    const ids=new Set(items.map(item=>item.id));
    for(const [id,row] of rows){if(!ids.has(id)&&!pending.has(id)){row.label.remove();rows.delete(id);}}
    for(const item of items){
     let row=rows.get(item.id);
     if(!row){
      const label=add('label','',list),box=add('input','',label),text=add('span','',label);
      box.type='checkbox';row={label,box,text,purchased:item.purchased};rows.set(item.id,row);
      box.addEventListener('change',async()=>{
       if(pending.has(item.id))return;
       const purchased=box.checked,previous=row.purchased;pending.add(item.id);writeEpoch++;box.disabled=true;
       try{
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,purchased})});
        if(!response.ok)throw Error();row.purchased=purchased;status.textContent='';
       }catch{box.checked=previous;status.textContent='Could not sync. Try again.';}
       finally{pending.delete(item.id);writeEpoch++;box.disabled=false;}
      });
     }
     row.text.textContent=item.name+' '+(item.quantity??'');
     if(!pending.has(item.id)){row.box.checked=item.purchased;row.purchased=item.purchased;}
     list.append(row.label);
    }
   }
   reconcile(data.items);
   setInterval(async()=>{
    if(document.hidden||polling)return;polling=true;const epoch=writeEpoch;
    try{
     const response=await fetch(jsonEndpoint,{cache:'no-store'});if(!response.ok)return;
     const current=await response.json();
     showStopped(current);
     // A GET begun before/during a local write must not roll back its result.
     if(epoch===writeEpoch)reconcile(current.items);
    }catch{}finally{polling=false;}
   },30000);
  }
 }catch{root.textContent='This link is unavailable or has expired.';}
})();
