import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
const root = new URL('../',import.meta.url);

test('deployment output includes referenced app assets and excludes internal files', () =>
{
    execFileSync(process.execPath,['scripts/build-site.mjs'],{cwd:root});
    const out = new URL('dist/',root);
    assert.deepEqual(readdirSync(out).sort(),['404.html','LICENSE','_headers','assets','index.html','legal.html','robots.txt','sitemap.xml','src'].sort());
    const html = readFileSync(new URL('index.html',out),'utf8');
    for (const [,path] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))
    {
        assert.ok(existsSync(new URL(path,out)), 'Missing deploy asset: ' + path);
    }
    for (const name of ['.git','.env','docs','local-sql','supabase','tests','scripts','package.json'])
    {
        assert.equal(existsSync(new URL(name,out)),false,'Internal file leaked: ' + name);
    }
    const ui=readFileSync(new URL('src/mission-copilot-ui.js',out),'utf8');
    assert.doesNotMatch(ui,/OPENAI_API_KEY|supabase\.com\/dashboard|functions\.invoke|data-copilot-prompt/);
});
