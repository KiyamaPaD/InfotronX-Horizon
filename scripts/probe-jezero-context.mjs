// Network smoke test for NASA controlled Jezero mosaics before promoting them.
const layers = [
    { id:"ctx-controlled",dataset:"JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0" },
    { id:"midway",dataset:"NES_JEZ_MID_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018" }
];
const samples = [
    { id:"jezero-center",lat:18.4446,lon:77.4509 },
    { id:"reported-edge",lat:18.39862,lon:77.57575 }
];
const root="https://trek.nasa.gov/tiles/Mars/EQ/";
const timeout=AbortSignal.timeout(10000);

function getCoords(p,z)
{
    return {
        x:Math.floor((p.lon+180)/360*2**(z+1)),
        y:Math.floor((90-p.lat)/180*2**z)
    };
}

async function probe(name,url,isXml=false)
{
    try
    {
        const r=await fetch(url,{signal:AbortSignal.timeout(9500)});
        const buf=new Uint8Array(await r.arrayBuffer());
        const type=r.headers.get("content-type");
        let alpha=null,dimensions=null,template=null,levels=null;
        if(isXml)
        {
            const xml=new TextDecoder().decode(buf);
            template=xml.match(/<ResourceURL[^>]*template="([^"]+)"/i)?.[1]||null;
            levels=[...xml.matchAll(/<TileMatrix[^>]*>[\s\S]*?<ows:Identifier>([^<]+)<\/ows:Identifier>/g)].map(m=>m[1]).slice(0,20);
        }
        else if(buf[0]===137&&buf[1]===80&&buf[2]===78&&buf[3]===71)
        {
            const v=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
            dimensions=[v.getUint32(16),v.getUint32(20)];
            alpha=[4,6].includes(buf[25]);
        }
        else if(buf[0]===255&&buf[1]===216)
        {
            alpha=false;
        }
        console.log(JSON.stringify({name,status:r.status,type,bytes:buf.length,alpha,dimensions,template,levels}));
    }
    catch(e)
    {
        console.log(JSON.stringify({name,error:e.name+": "+e.message}));
    }
}
const tasks=[];
for(const layer of layers)
{
    const base=root+layer.dataset+"/1.0.0";
    tasks.push(probe(layer.id+":capabilities",base+"/WMTSCapabilities.xml",true));
    for(const sample of samples)
    {
        for(const z of [8,9,10,11])
        {
            const {x,y}=getCoords(sample,z);
            for(const ext of ["png","jpg"])
            {
                tasks.push(probe(layer.id+":"+sample.id+":"+z+":"+ext,
                    base+"/default/default028mm/"+z+"/"+y+"/"+x+"."+ext));
            }
        }
    }
}
await Promise.all(tasks);
