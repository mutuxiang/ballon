const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopPet',{
  focus:active=>ipcRenderer.send('pet:focus',active),
  configure:data=>ipcRenderer.send('pet:configure',data),
  menu:()=>ipcRenderer.send('pet:menu'),
  drag:phase=>ipcRenderer.send('pet:drag',phase),
  onAction:callback=>ipcRenderer.on('pet:action',(_event,data)=>callback(data))
});
