import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
const root = new URL('../',import.meta.url);
const out = new URL('dist/',root);
// Explicit deployment allowlist: internal reports, SQL, tests and server functions stay out.
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for (const path of ['index.html','404.html','legal.html','robots.txt','sitemap.xml','LICENSE','src','assets'])
{
    await cp(new URL(path,root),new URL(path,out),{recursive:true});
}
await writeFile(new URL('_headers',out),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
console.log('Static site built in dist/');
