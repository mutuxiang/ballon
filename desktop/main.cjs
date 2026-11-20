const {app,BrowserWindow,ipcMain,Menu,screen}=require('electron');
const path=require('node:path');
const {uIOhook,UiohookKey}=require('uiohook-napi');
const {spawn}=require('node:child_process');
let focusHelper=null,focusActive=false;
let pedalEnabled=true;
let win,options={skins:[],outfits:[]},drag=null;
if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',()=>{win?.show();});
app.whenReady().then(()=>{
  focusHelper=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'focus-window.ps1'),'-PetProcessId',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  focusHelper.stdin.on('error',e=>console.error('Focus helper input:',e.message));
  focusHelper.stderr.on('data',data=>console.error(String(data)));
  let helperBuffer='';focusHelper.stdout.on('data',data=>{helperBuffer+=data;let newline;while((newline=helperBuffer.indexOf('\n'))>=0){const line=helperBuffer.slice(0,newline);helperBuffer=helperBuffer.slice(newline+1);try{const result=JSON.parse(line);if(result.type==='ink')win?.webContents.send('pet:action',{type:'ink',value:result.light});else console.log('Focus result',result);}catch{}}});
  ipcMain.on('pet:sample',(_e,point)=>{const b=win.getBounds(),scale=screen.getDisplayMatching(b).scaleFactor;focusHelper?.stdin.write('sample '+Math.round((b.x+point.x)*scale)+' '+Math.round((b.y+point.y)*scale)+'\n');});

  const area=screen.getPrimaryDisplay().workArea;
  win=new BrowserWindow({width:740,height:380,x:area.x+area.width-760,y:area.y+area.height-400,transparent:true,frame:false,alwaysOnTop:true,resizable:false,hasShadow:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.on('closed',()=>focusHelper?.stdin.end('exit\n'));
  win.setMenuBarVisibility(false);win.loadFile(path.join(__dirname,'../dist/index.html'),{query:{pet:'1'}});
  let impactWindow=null;
  ipcMain.on('pet:burst',(_e,point)=>{
    const petBounds=win.getBounds(),display=screen.getDisplayMatching(petBounds);
    if(impactWindow&&!impactWindow.isDestroyed())impactWindow.close();
    impactWindow=new BrowserWindow({x:display.bounds.x,y:display.bounds.y,width:display.bounds.width,height:display.bounds.height,transparent:true,frame:false,alwaysOnTop:true,focusable:false,skipTaskbar:true,hasShadow:false,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
    impactWindow.setIgnoreMouseEvents(true);
    const overlay=impactWindow;
    overlay.loadFile(path.join(__dirname,'impact.html'),{query:{x:String(petBounds.x+point.x-display.bounds.x),y:String(petBounds.y+point.y-display.bounds.y)}});
    overlay.once('ready-to-show',()=>{if(!overlay.isDestroyed()){overlay.showInactive();overlay.setBounds(display.bounds);}});
    setTimeout(()=>{if(!overlay.isDestroyed())overlay.close();},2200);
  });
  ipcMain.on('pet:configure',(_e,data)=>{options=data;});
  const send=(type,value)=>win.webContents.send('pet:action',{type,value});
  for(const [event,down] of [['keydown',true],['keyup',false]])uIOhook.on(event,e=>{if(!pedalEnabled)return;const side=e.keycode===UiohookKey.A?'left':e.keycode===UiohookKey.L?'right':null;if(side)send('pedal',{side,down});});
  uIOhook.on('keydown',e=>{if(e.keycode===UiohookKey.Escape&&focusActive){endFocus();send('focus-end');}});
  function endFocus(){focusHelper?.stdin.write('exit\n');focusActive=false;}
  ipcMain.on('pet:focus',(_e,active)=>{focusActive=active;focusHelper?.stdin.write(active?'enter\n':'exit\n');if(!active&&impactWindow&&!impactWindow.isDestroyed())impactWindow.close();});
  uIOhook.start();
  ipcMain.on('pet:menu',()=>Menu.buildFromTemplate([
    {label:'脚蹬控制 A / L',type:'checkbox',checked:pedalEnabled,click:item=>{pedalEnabled=item.checked;send('pedal-reset');}},
    {label:'充气状态',submenu:[['none','没气 · 躺平'],['low','气少 · 摸鱼'],['high','气多 · 营业']].map(([id,label])=>({label,click:()=>send('air',id)}))},
    {label:'表情',submenu:[{label:'随动作切换',click:()=>send('motion',true)},...options.skins.map(s=>({label:s.name,click:()=>send('skin',s.id)}))]},
    {label:'衣服',submenu:options.outfits.map(s=>({label:s.name,click:()=>send('outfit',s.id)}))},
    {label:'主题皮肤',submenu:(options.themes||[]).map(s=>({label:s.name,click:()=>send('theme',s.id)}))},
    {label:'暂停 / 继续',click:()=>send('pause')},
    {label:'始终置顶',type:'checkbox',checked:win.isAlwaysOnTop(),click:item=>win.setAlwaysOnTop(item.checked)},
    {type:'separator'},{label:'退出桌宠',click:()=>app.quit()}
  ]).popup({window:win}));
  ipcMain.on('pet:drag',(_e,phase)=>{
    if(phase==='start')drag={cursor:screen.getCursorScreenPoint(),bounds:win.getBounds()};
    else if(phase==='move'&&drag){const p=screen.getCursorScreenPoint();win.setPosition(drag.bounds.x+p.x-drag.cursor.x,drag.bounds.y+p.y-drag.cursor.y);}
    else if(phase==='end')drag=null;
  });
});
app.on('window-all-closed',()=>app.quit());

app.on('will-quit',()=>{uIOhook.stop();focusHelper?.stdin.end('exit\n');});
