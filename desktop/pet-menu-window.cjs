const path=require('node:path');
function createPetMenuWindow({BrowserWindow,ipcMain,screen,parent,getState,onAction}){
  let current=null,point;
  const owns=event=>current&&!current.isDestroyed()&&event.sender===current.webContents;
  const close=()=>{if(current&&!current.isDestroyed())current.close();};
  ipcMain.handle('pet-menu:state',event=>{if(!owns(event))throw new Error('菜单已关闭');return getState();});
  ipcMain.on('pet-menu:close',event=>{if(owns(event))close();});
  ipcMain.on('pet-menu:height',(event,height)=>{
    if(!owns(event)||!Number.isFinite(height))return;
    const area=screen.getDisplayNearestPoint(point).workArea;
    const width=Math.min(312,area.width-16),nextHeight=Math.max(120,Math.min(Math.ceil(height),area.height-16));
    current.setBounds({x:Math.round(Math.max(area.x+8,Math.min(point.x,area.x+area.width-width-8))),y:Math.round(Math.max(area.y+8,Math.min(point.y,area.y+area.height-nextHeight-8))),width,height:nextHeight});
  });
  ipcMain.handle('pet-menu:action',async(event,action,value)=>{
    if(!owns(event))throw new Error('菜单已关闭');
    const window=current;
    await onAction(action,value);
    if(!window.isDestroyed())window.close();return true;
  });
  return {close,open(){
    close();point=screen.getCursorScreenPoint();
    const area=screen.getDisplayNearestPoint(point).workArea,width=Math.min(312,area.width-16),height=Math.min(324,area.height-16);
    const window=new BrowserWindow({parent,width,height,x:Math.round(Math.max(area.x+8,Math.min(point.x,area.x+area.width-width-8))),y:Math.round(Math.max(area.y+8,Math.min(point.y,area.y+area.height-height-8))),show:false,frame:false,transparent:true,resizable:false,maximizable:false,minimizable:false,skipTaskbar:true,alwaysOnTop:true,hasShadow:false,webPreferences:{preload:path.join(__dirname,'pet-menu-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    current=window;
    window.once('ready-to-show',()=>{if(!window.isDestroyed()){window.show();window.focus();}});
    window.on('blur',()=>{if(!window.isDestroyed())window.close();});
    window.on('closed',()=>{if(current===window)current=null;});
    window.loadFile(path.join(__dirname,'pet-menu.html')).catch(error=>{console.error(error);if(!window.isDestroyed())window.close();});
    return window;
  }};
}
module.exports={createPetMenuWindow};
