(()=>{
const J=async(u,o={})=>{const r=await fetch(u,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...o});if(!r.ok)throw new Error(r.status);return r.status===204?null:r.json()};
let me={sections:[]};const ready=J('/api/me').then(x=>{me=x}).catch(()=>{});
const sd=d=>({id:d.id,exists:true,data:()=>{const{id,...r}=d;return r},metadata:{}});
function poll(url,next,err,list){let prev=null,stop=false,t;const tick=async()=>{if(stop)return;if(!document.hidden||prev===null)try{const L=await J(url).catch(e=>{if(!list&&String(e.message)==='404')return null;throw e});
  if(!list){const s=JSON.stringify(L);if(s!==prev){prev=s;next({id:url.split('/').pop(),exists:!!L,data:()=>{if(!L)return undefined;const{id,...r}=L;return r},metadata:{}})}}
  else{const m=new Map(L.map(d=>[d.id,d])),ch=[];if(prev===null)L.forEach(d=>ch.push({type:'added',doc:sd(d)}));else{L.forEach(d=>{const o=prev.get(d.id);if(!o)ch.push({type:'added',doc:sd(d)});else if(JSON.stringify(o)!==JSON.stringify(d))ch.push({type:'modified',doc:sd(d)})});prev.forEach((d,i)=>{if(!m.has(i))ch.push({type:'removed',doc:sd(d)})})}
   if(prev===null||ch.length){prev=m;next({docs:L.map(sd),size:L.length,empty:!L.length,docChanges:()=>ch,metadata:{}})}}}catch(e){err&&err(e)}
 t=setTimeout(tick,3000)};tick();return()=>{stop=true;clearTimeout(t)}}
const ref=(c,id)=>({id,path:c+'/'+id,get:async()=>{try{return sd(await J('/api/'+c+'/'+id))}catch(e){return{id,exists:false,data:()=>undefined,metadata:{}}}},
  set:d=>J('/api/'+c+'/'+id,{method:'PUT',body:JSON.stringify(d)}).then(()=>{}),update:d=>J('/api/'+c+'/'+id,{method:'PATCH',body:JSON.stringify(d)}).then(()=>{}),
  delete:()=>J('/api/'+c+'/'+id,{method:'DELETE'}).then(()=>{}),onSnapshot:(n,e)=>poll('/api/'+c+'/'+id,n,e,false)});
const db={collection:c=>({path:c,doc:id=>ref(c,id),add:async d=>ref(c,(await J('/api/'+c,{method:'POST',body:JSON.stringify(d)})).id),onSnapshot:(n,e)=>poll('/api/'+c,n,e,true)}),doc:p=>{const[c,id]=p.split('/');return ref(c,id)}};
const user={canEdit:async()=>!!(me.sections&&me.sections.length),sections:async()=>me.sections||[],open:async()=>!!me.open};
const dl={save:async({filename,data})=>{const a=document.createElement('a');a.href=URL.createObjectURL(data instanceof Blob?data:new Blob([data]));a.download=filename;a.click();return{status:'saved'}}};
window.claude={use:async n=>{await ready;return n==='db'?db:n==='user'?user:n==='downloads'?dl:null}};
})();
