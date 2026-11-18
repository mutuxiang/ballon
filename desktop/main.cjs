const {app,BrowserWindow,ipcMain,Menu,screen}=require('electron');
const path=require('node:path');
const {uIOhook,UiohookKey}=require('uiohook-napi');
let pedalEnabled=true;
let win,options={skins:[],outfits:[]},drag=null;
if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',()=>{win?.show();});
app.whenReady().then(()=>{
  const area=screen.getPrimaryDisplay().workArea;
  win=new BrowserWindow({width:740,height:380,x:area.x+area.width-760,y:area.y+area.height-400,transparent:true,frame:false,alwaysOnTop:true,resizable:false,hasShadow:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.setMenuBarVisibility(false);win.loadFile(path.join(__dirname,'../dist/index.html'),{query:{pet:'1'}});
  ipcMain.on('pet:configure',(_e,data)=>{options=data;});
  const send=(type,value)=>win.webContents.send('pet:action',{type,value});
  for(const [event,down] of [['keydown',true],['keyup',false]])uIOhook.on(event,e=>{if(!pedalEnabled)return;const side=e.keycode===UiohookKey.A?'left':e.keycode===UiohookKey.L?'right':null;if(side)send('pedal',{side,down});});
  uIOhook.start();
  ipcMain.on('pet:menu',()=>Menu.buildFromTemplate([
    {label:'脚蹬控制 A / L',type:'checkbox',checked:pedalEnabled,click:item=>{pedalEnabled=item.checked;send('pedal-reset');}},
    {label:'充气状态',submenu:[['none','没气 · 躺平'],['low','气少 · 摸鱼'],['high','气多 · 营业']].map(([id,label])=>({label,click:()=>send('air',id)}))},
    {label:'表情',submenu:[{label:'随动作切换',click:()=>send('motion',true)},...options.skins.map(s=>({label:s.name,click:()=>send('skin',s.id)}))]},
    {label:'衣服',submenu:options.outfits.map(s=>({label:s.name,click:()=>send('outfit',s.id)}))},
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

app.on('will-quit',()=>uIOhook.stop());
