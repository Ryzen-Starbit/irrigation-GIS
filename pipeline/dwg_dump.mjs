import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web'
import fs from 'fs'
const lib = await LibreDwg.create(new URL('./node_modules/@mlightcad/libredwg-web/wasm/', import.meta.url).pathname)
const buf = fs.readFileSync(process.argv[2])
const ptr = lib.dwg_read_data(buf, Dwg_File_Type.DWG)
const db = lib.convert(ptr)
lib.dwg_free(ptr)
const ents = db.entities
const byLayer = {}, byType={}
for (const e of ents){ const k=e.layer; byLayer[k]??={n:0,types:{}}; byLayer[k].n++; byLayer[k].types[e.type]=(byLayer[k].types[e.type]||0)+1; byType[e.type]=(byType[e.type]||0)+1 }
console.log('entities', ents.length, byType)
console.log('header extents', db.header?.EXTMIN, db.header?.EXTMAX, 'INSUNITS', db.header?.INSUNITS)
for (const [k,v] of Object.entries(byLayer).sort((a,b)=>b[1].n-a[1].n)) console.log(k.padEnd(40), v.n, JSON.stringify(v.types))
const texts = ents.filter(e=>e.type==='TEXT'||e.type==='MTEXT').map(e=>`${e.layer}::${e.text}`)
const blocks = ents.filter(e=>e.type==='INSERT').map(e=>e.name); const bc={}; blocks.forEach(b=>bc[b]=(bc[b]||0)+1); console.log('INSERT blocks', bc)
fs.writeFileSync(process.argv[3] || 'dwg.json', JSON.stringify(db, (k,v)=>typeof v==='bigint'?Number(v):v))
