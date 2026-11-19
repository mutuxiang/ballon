// Standalone preview of the committed production build; no npm install needed.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'dist'),port=5190;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:'air-worker-play',port}));return;}
  let file;try{const pathname=decodeURIComponent(req.url.split('?')[0]);file=path.resolve(root,'.'+(pathname==='/'?'/play.html':pathname));}catch{res.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'端口 5190 已被占用，请关闭已有预览后重试。':error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`下班保卫战 http://127.0.0.1:${port}/play.html`));
