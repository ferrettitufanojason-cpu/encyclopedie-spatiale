import { tap } from './lib/simbad.mjs';
for (const p of ["NAME M87%","M87*%","NAME Powehi%","NAME Cen A%", "NGC  4486%","NAME GW1%","NAME Cyg X-1%"]) { try { const r=await tap(`select top 6 id from ident where id like '${p}'`); console.log(p,'=>',r.map(x=>x.id).join(' | ')); } catch(e){ console.log(p,'ERR'); } }
