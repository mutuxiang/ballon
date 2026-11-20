const {APP_ICON}=require('./branding.cjs');
// Own the window independently of the native popup menu's lifetime.
function createTodayPhotoWindow({BrowserWindow,screen,parent,preloadPath,pagePath,onApply}){
  let current=null;
  function show(window){
    if(window.isDestroyed())return;
    if(window.isMinimized())window.restore();
    window.show();window.moveTop();window.focus();
  }
  function open(){
    if(current&&!current.isDestroyed()){show(current);return current;}
    const area=screen.getDisplayMatching(parent.getBounds()).workArea;
    const width=Math.min(760,area.width-32),height=Math.min(760,area.height-32);
    const window=new BrowserWindow({
      icon:APP_ICON,
      parent,show:false,width,height,minWidth:Math.min(520,width),minHeight:Math.min(500,height),
      x:Math.round(area.x+(area.width-width)/2),y:Math.round(area.y+(area.height-height)/2),
      title:'今日形象',backgroundColor:'#fdfcf9',
      webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true},
    });
    current=window;
    window.setMenuBarVisibility(false);
    window.once('ready-to-show',()=>show(window));
    window.on('closed',()=>{if(current===window)current=null;});
    window.loadFile(pagePath).then(()=>show(window)).catch(error=>{
      console.error('Today photo window failed to load:',error);
      window.destroy();
    });
    return window;
  }
  return {
    open,
    async apply(sender,appearance){
      if(!current||current.isDestroyed()||sender!==current.webContents)throw new Error('请重新打开自定义窗口。');
      await onApply(appearance);return {ok:true};
    },
    close(){if(current&&!current.isDestroyed())current.close();},
  };
}
module.exports={createTodayPhotoWindow};
