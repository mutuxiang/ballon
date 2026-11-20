const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopPet',{
  applyTodayAvatar:appearance=>ipcRenderer.invoke('pet:today-avatar',appearance),
  appearanceApplied:(id,error)=>ipcRenderer.send('pet:appearance-applied',{id,error}),
  burst:point=>ipcRenderer.send('pet:burst',point),
  sample:point=>ipcRenderer.send('pet:sample',point),
  focus:active=>ipcRenderer.send('pet:focus',active),
  configure:data=>ipcRenderer.send('pet:configure',data),
  menu:()=>ipcRenderer.send('pet:menu'),
  drag:phase=>ipcRenderer.send('pet:drag',phase),
  onAction:callback=>ipcRenderer.on('pet:action',(_event,data)=>callback(data))
});
