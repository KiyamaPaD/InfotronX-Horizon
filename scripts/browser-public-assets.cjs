const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
// Optional headless-test transport for public assets, using the machine's verified HTTPS proxy.
// Never forwards browser credentials, request bodies or private backend calls.
module.exports = async function publicAssets(page)
{
    const hosts=new Set(['trek.nasa.gov','esm.sh','fonts.googleapis.com','fonts.gstatic.com']);
    await page.route(url=>hosts.has(url.hostname),async route=>
    {
        if(route.request().method()!=='GET') return route.continue();
        try
        {
            const {stdout}=await exec('curl',['--silent','--show-error','--location','--max-time','25','--write-out','\n%{http_code} %{content_type}',route.request().url()],{encoding:'buffer',maxBuffer:10000000});
            const end=stdout.lastIndexOf(10);
            const [code,...type]=stdout.subarray(end+1).toString().split(' ');
            if(Number(code)<100) return route.abort();
            await route.fulfill({status:Number(code),contentType:type.join(' ')||'application/octet-stream',headers:{'access-control-allow-origin':'*'},body:stdout.subarray(0,end)});
        }
        catch { await route.abort(); }
    });
};
