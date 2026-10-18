const express=require('express'),fs=require('fs'),path=require('path'),crypto=require('crypto');
try{fs.readFileSync(path.join(__dirname,'.env'),'utf8').split(/\r?\n/).forEach(l=>{const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2]})}catch(e){}
const PORT=process.env.PORT||3000,DIR=process.env.DATA_DIR||path.join(__dirname,'data'),PASS=process.env.ADMIN_PASSWORD;
if(!PASS){console.error('Khalad: deji ADMIN_PASSWORD, tusaale: ADMIN_PASSWORD=erayga-sirta node server.js');process.exit(1)}
fs.mkdirSync(DIR,{recursive:true});
const F=path.join(DIR,'db.json');
let D={menu:{},orders:{},expenses:{},settings:{},_secret:crypto.randomBytes(32).toString('hex')};
try{D={...D,...JSON.parse(fs.readFileSync(F,'utf8'))}}catch(e){}
if(!D._seeded){D._seeded=1;try{D.menu=JSON.parse(fs.readFileSync([path.join(__dirname,'menu-seed.json'),path.join(__dirname,'seed','menu.json')].find(fs.existsSync),'utf8'))}catch(e){}}
let tm;const save=()=>{clearTimeout(tm);tm=setTimeout(()=>{fs.writeFileSync(F+'.tmp',JSON.stringify(D));fs.renameSync(F+'.tmp',F)},200)};save();
const sign=s=>crypto.createHmac('sha256',D._secret).update(s).digest('hex');
const mk=sc=>{const b=(Date.now()+30*864e5)+'.'+sc;return b+'.'+sign(b)};
const secs=r=>{const c=(r.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('s='));if(!c)return '';const [e,sc,h]=c.slice(2).split('.');if(!e||!/^[0-9a-f]{64}$/.test(h||'')||!/^[amors]{0,5}$/.test(sc||'')||+e<Date.now())return '';return crypto.timingSafeEqual(Buffer.from(h),Buffer.from(sign(e+'.'+sc)))?sc:''};
const can=(r,...k)=>{const s=secs(r);return s.includes('a')||k.some(x=>s.includes(x))};
const hit=(m,k,max,ms)=>{const n=Date.now(),a=(m[k]=(m[k]||[]).filter(t=>n-t<ms));a.push(n);return a.length>max};
const LG={},OR={},nid=()=>crypto.randomBytes(8).toString('hex');
const PW={a:PASS,o:process.env.ORDERS_PASSWORD,m:process.env.MENU_PASSWORD,r:process.env.REPORTS_PASSWORD,s:process.env.SETTINGS_PASSWORD};
const OPENO=!process.env.ORDERS_PASSWORD;
const app=express();app.set('trust proxy',1);app.use(express.json({limit:'1mb'}));
app.use((q,s,n)=>{s.setHeader('X-Content-Type-Options','nosniff');n()});
app.get('/api/me',(q,s)=>s.json({sections:[...secs(q)],open:OPENO}));
app.post('/api/login',(q,s)=>{
  if(hit(LG,q.ip,8,6e5))return s.status(429).json({error:'rate'});
  const h=x=>crypto.createHash('sha256').update(String(x)).digest(),p=h(q.body&&q.body.password),old=secs(q);let sc=old;
  Object.entries(PW).forEach(([k,v])=>{if(v&&crypto.timingSafeEqual(p,h(v))&&!sc.includes(k))sc+=k});
  if(sc===old)return s.status(401).json({error:'bad'});
  s.setHeader('Set-Cookie','s='+mk(sc)+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000'+(q.secure?'; Secure':''));s.json({sections:[...sc]})});
app.get('/logout',(q,s)=>{s.setHeader('Set-Cookie','s=; HttpOnly; Path=/; Max-Age=0');s.redirect('/')});
const COL=['menu','orders','expenses','settings'],PUB=['menu','settings'],P={menu:['m'],settings:['s'],expenses:['r'],orders:['o','r']};
const OBJ=(q,s,n)=>q.body&&typeof q.body==='object'&&!Array.isArray(q.body)?n():s.status(400).end();
app.param('c',(q,s,n,c)=>COL.includes(c)?n():s.status(404).end());
app.param('id',(q,s,n,id)=>/^[A-Za-z0-9-]{1,40}$/.test(id)?n():s.status(400).end());
const ok=q=>(q.params.c==='orders'&&OPENO)||can(q,...P[q.params.c]);
const rd=(q,s,n)=>PUB.includes(q.params.c)||ok(q)?n():s.status(401).json({error:'auth'});
const wr=(q,s,n)=>ok(q)?n():s.status(401).json({error:'auth'});
app.get('/api/:c',rd,(q,s)=>s.json(Object.entries(D[q.params.c]).map(([id,v])=>({id,...v}))));
app.get('/api/:c/:id',rd,(q,s)=>{const v=D[q.params.c][q.params.id];v?s.json({id:q.params.id,...v}):s.status(404).json(null)});
app.post('/api/orders',OBJ,(q,s,n)=>{
  if(can(q,'r'))return n('route');
  if(hit(OR,q.ip,8,6e5))return s.status(429).json({error:'rate'});
  const b=q.body,cfg=D.settings.main||{},rate=cfg.vatOn===false?0:(Number(cfg.vat)||0),menu=Object.values(D.menu),str=(v,l)=>String(v==null?'':v).slice(0,l);
  const items=(Array.isArray(b.items)?b.items:[]).slice(0,60).map(i=>{const m=menu.find(x=>x.name===i.n),n=Math.floor(+i.q);return m&&n>0&&n<=99?{n:m.name,p:m.price,q:n}:null}).filter(Boolean);
  if(!items.length||!str(b.name,60).trim())return s.status(400).json({error:'bad'});
  const sub=Math.round(items.reduce((a,i)=>a+i.p*i.q,0)*100)/100,tax=Math.round(sub*rate)/100,id=nid();
  D.orders[id]={items,sub,vat:rate,tax,total:Math.round((sub+tax)*100)/100,acc:str(b.acc,30),name:str(b.name,60),phone:str(b.phone,30),note:str(b.note,120),type:['dine','take','deliv'].includes(b.type)?b.type:'dine',status:'new',at:Date.now()};
  save();s.json({id})});
app.post('/api/:c',wr,OBJ,(q,s)=>{const id=nid();D[q.params.c][id]={...q.body};save();s.json({id})});
app.put('/api/:c/:id',wr,OBJ,(q,s)=>{D[q.params.c][q.params.id]={...q.body};save();s.json({id:q.params.id})});
app.patch('/api/:c/:id',wr,OBJ,(q,s)=>{const o=D[q.params.c][q.params.id];if(!o)return s.status(404).end();D[q.params.c][q.params.id]={...o,...q.body};save();s.json({id:q.params.id})});
app.delete('/api/:c/:id',wr,(q,s)=>{delete D[q.params.c][q.params.id];save();s.status(204).end()});
app.get('/health',(q,s)=>s.json({ok:true,time:Date.now()}));
const pub=n=>[path.join(__dirname,'public',n),path.join(__dirname,n)].find(fs.existsSync);
app.get(['/','/index.html'],(q,s)=>s.sendFile(pub('index.html')));
app.get('/shim.js',(q,s)=>s.sendFile(pub('shim.js')));
app.listen(PORT,()=>console.log('Website-ku wuu socdaa: http://localhost:'+PORT+'  (maamul: /#admin)'));
