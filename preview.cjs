const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'dist');
http.createServer((req,res)=>{let filename;try{filename=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));}catch{res.writeHead(400).end();return;}
if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
fs.readFile(filename,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary'})[path.extname(filename)]||'application/octet-stream');res.end(data);});
}).listen(5187,'127.0.0.1',()=>console.log('Open http://127.0.0.1:5187/'));
