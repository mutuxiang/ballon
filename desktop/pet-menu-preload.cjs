const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('petMenu',{
  state:()=>ipcRenderer.invoke('pet-menu:state'),
  action:(action,value)=>ipcRenderer.invoke('pet-menu:action',action,value),
  close:()=>ipcRenderer.send('pet-menu:close'),
  height:height=>ipcRenderer.send('pet-menu:height',height)
});
