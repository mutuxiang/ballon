const {createTodayPhotoWindow}=require('./today-photo-window.cjs');
const {attachAppearanceIpc}=require('./today-appearance-ipc.cjs');
const {app,BrowserWindow,ipcMain,screen}=require('electron');
const {APP_ID,APP_ICON,APP_NAME}=require('./branding.cjs');
const existingUserData=app.getPath('userData');app.setName(APP_NAME);app.setPath('userData',existingUserData);
if(process.platform==='win32')app.setAppUserModelId(APP_ID);
const path=require('node:path');
const {uIOhook,UiohookKey}=require('uiohook-napi');
const {spawn}=require('node:child_process');
let focusHelper=null,focusActive=false;
let pedalEnabled=true;
const petSizes=[.5,.75,1,1.25,1.5];
let petScale=1;
let win,gameWindow=null,options={themes:[]},drag=null,quitting=false;
function openGame(){
  if(gameWindow&&!gameWindow.isDestroyed()){
    if(gameWindow.isMinimized())gameWindow.restore();
    gameWindow.show();gameWindow.focus();return;
  }
  const display=screen.getDisplayMatching(win.getBounds());
  const area=display.workArea,width=Math.min(1120,area.width),height=Math.min(760,area.height);
  gameWindow=new BrowserWindow({icon:APP_ICON,x:Math.round(area.x+(area.width-width)/2),y:Math.round(area.y+(area.height-height)/2),width,height,fullscreen:false,fullscreenable:false,show:false,backgroundColor:'#f2eee5',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const opened=gameWindow;
  opened.setMenuBarVisibility(false);
  opened.loadFile(path.join(__dirname,'../dist/play.html')).catch(error=>{console.error('Game load failed:',error);if(!opened.isDestroyed())opened.close();});
  opened.once('ready-to-show',()=>{if(!opened.isDestroyed()){
    win?.webContents.send('pet:action',{type:'pedal-reset'});win?.hide();
    opened.maximize();opened.show();opened.focus();
  }});
  opened.on('focus',()=>win?.webContents.send('pet:action',{type:'pedal-reset'}));
  opened.webContents.on('render-process-gone',()=>{if(!opened.isDestroyed())opened.close();});
  opened.on('closed',()=>{gameWindow=null;if(!quitting&&win&&!win.isDestroyed())win.show();});
}

if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',()=>{if(gameWindow&&!gameWindow.isDestroyed())openGame();else win?.show();});
app.on('before-quit',()=>{quitting=true;});
app.whenReady().then(()=>{
  focusHelper=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'focus-window.ps1'),'-PetProcessId',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  focusHelper.stdin.on('error',e=>console.error('Focus helper input:',e.message));
  focusHelper.stderr.on('data',data=>console.error(String(data)));
  let helperBuffer='';focusHelper.stdout.on('data',data=>{helperBuffer+=data;let newline;while((newline=helperBuffer.indexOf('\n'))>=0){const line=helperBuffer.slice(0,newline);helperBuffer=helperBuffer.slice(newline+1);try{const result=JSON.parse(line);if(result.type==='ink')win?.webContents.send('pet:action',{type:'ink',value:result.light});else console.log('Focus result',result);}catch{}}});
  ipcMain.on('pet:sample',(_e,point)=>{const b=win.getBounds(),scale=screen.getDisplayMatching(b).scaleFactor;focusHelper?.stdin.write('sample '+Math.round((b.x+point.x)*scale)+' '+Math.round((b.y+point.y)*scale)+'\n');});

  const area=screen.getPrimaryDisplay().workArea;
  win=new BrowserWindow({icon:APP_ICON,width:740,height:380,x:area.x+area.width-760,y:area.y+area.height-400,transparent:true,frame:false,alwaysOnTop:true,resizable:false,maximizable:false,fullscreenable:false,hasShadow:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.on('did-finish-load',()=>{
    win.webContents.setZoomFactor(1);
    win.webContents.setVisualZoomLevelLimits(1,1);
  });
  win.webContents.on('before-input-event',(event,input)=>{
    if((input.control||input.meta)&&['+','-','=','0'].includes(input.key))event.preventDefault();
  });
  win.webContents.on('zoom-changed',()=>win.webContents.setZoomFactor(1));
  win.on('closed',()=>{if(focusHelper&&!focusHelper.stdin.writableEnded)focusHelper.stdin.end('exit\n');});
  win.setMenuBarVisibility(false);win.loadFile(path.join(__dirname,'../dist/index.html'),{query:{pet:'1'}});
  let impactWindow=null;
  ipcMain.on('pet:burst',(_e,point)=>{
    const petBounds=win.getBounds(),display=screen.getDisplayMatching(petBounds);
    if(impactWindow&&!impactWindow.isDestroyed())impactWindow.close();
    impactWindow=new BrowserWindow({icon:APP_ICON,x:display.bounds.x,y:display.bounds.y,width:display.bounds.width,height:display.bounds.height,transparent:true,frame:false,alwaysOnTop:true,focusable:false,skipTaskbar:true,hasShadow:false,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
    impactWindow.setIgnoreMouseEvents(true);
    const overlay=impactWindow;
    overlay.loadFile(path.join(__dirname,'impact.html'),{query:{x:String(petBounds.x+point.x-display.bounds.x),y:String(petBounds.y+point.y-display.bounds.y)}});
    overlay.once('ready-to-show',()=>{if(!overlay.isDestroyed()){overlay.showInactive();overlay.setBounds(display.bounds);}});
    setTimeout(()=>{if(!overlay.isDestroyed())overlay.close();},2200);
  });
  const send=(type,value)=>win.webContents.send('pet:action',{type,value});
  function setPetSize(scale){
    if(!petSizes.includes(scale))return;
    petScale=scale;
    drag=null;
    const bounds=win.getBounds(),workArea=screen.getDisplayMatching(bounds).workArea;
    const width=Math.min(Math.round(740*scale),workArea.width);
    const height=Math.min(Math.round(380*scale),workArea.height);
    const x=Math.round(Math.max(workArea.x,Math.min(workArea.x+workArea.width-width,bounds.x+(bounds.width-width)/2)));
    const y=Math.round(Math.max(workArea.y,Math.min(workArea.y+workArea.height-height,bounds.y+bounds.height-height)));
    send('size',scale);
    win.setBounds({x,y,width,height});
  }
  ipcMain.on('pet:configure',(_e,data)=>{
    options=data;
    if(petSizes.includes(data.scale)&&data.scale!==petScale)setPetSize(data.scale);
  });
  const appearanceRelay=attachAppearanceIpc({ipcMain,window:win});
  const photoController=createTodayPhotoWindow({
    BrowserWindow,screen,parent:win,preloadPath:path.join(__dirname,'preload.cjs'),
    pagePath:path.join(__dirname,'../dist/photo.html'),onApply:appearance=>appearanceRelay.apply(appearance),
  });
  ipcMain.handle('pet:today-avatar',(event,appearance)=>photoController.apply(event.sender,appearance));
  win.on('closed',()=>photoController.close());
  for(const [event,down] of [['keydown',true],['keyup',false]])uIOhook.on(event,e=>{if(!pedalEnabled||gameWindow)return;const side=e.keycode===UiohookKey.A?'left':e.keycode===UiohookKey.L?'right':null;if(side)send('pedal',{side,down});});
  uIOhook.on('keydown',e=>{if(e.keycode===UiohookKey.Escape&&focusActive){endFocus();send('focus-end');}});
  function endFocus(){focusHelper?.stdin.write('exit\n');focusActive=false;}
  ipcMain.on('pet:focus',(_e,active)=>{focusActive=active;focusHelper?.stdin.write(active?'enter\n':'exit\n');if(!active&&impactWindow&&!impactWindow.isDestroyed())impactWindow.close();});
  uIOhook.start();
  const menuController=require('./pet-menu-window.cjs').createPetMenuWindow({
    BrowserWindow,ipcMain,screen,parent:win,
    getState:()=>({themes:options.themes||[],theme:options.theme||'none',scale:petScale}),
    onAction:async(action,value)=>{
      if(action==='exercise'){if(focusActive){endFocus();send('focus-end');}openGame();}
      else if(action==='custom')photoController.open();
      else if(action==='reset')await appearanceRelay.apply(null);
      else if(action==='theme'&&(options.themes||[]).some(theme=>theme.id===value))send('theme',value);
      else if(action==='size'&&petSizes.includes(value))setPetSize(value);
      else if(action==='quit')app.quit();
      else throw new Error('无效的菜单操作');
    }
  });
  ipcMain.on('pet:menu',event=>{if(event.sender===win.webContents&&!gameWindow)menuController.open();});
  win.on('closed',()=>menuController.close());
  ipcMain.on('pet:drag',(_e,phase)=>{
    if(phase==='start')drag={cursor:screen.getCursorScreenPoint(),bounds:win.getBounds()};
    else if(phase==='move'&&drag){const p=screen.getCursorScreenPoint();win.setPosition(drag.bounds.x+p.x-drag.cursor.x,drag.bounds.y+p.y-drag.cursor.y);}
    else if(phase==='end')drag=null;
  });
});
app.on('window-all-closed',()=>app.quit());

app.on('will-quit',()=>{uIOhook.stop();if(focusHelper&&!focusHelper.stdin.writableEnded)focusHelper.stdin.end('exit\n');});
