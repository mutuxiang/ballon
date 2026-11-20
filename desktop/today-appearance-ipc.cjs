function attachAppearanceIpc({ipcMain,window,timeoutMs=7000}){
  let serial=0;const pending=new Map();
  function reply(event,message){
    if(event.sender!==window.webContents||!message)return;
    const job=pending.get(message.id);if(!job)return;
    pending.delete(message.id);clearTimeout(job.timer);
    if(message.error)job.reject(new Error(String(message.error)));else job.resolve();
  }
  ipcMain.on('pet:appearance-applied',reply);
  function dispose(){
    ipcMain.removeListener('pet:appearance-applied',reply);
    for(const job of pending.values()){clearTimeout(job.timer);job.reject(new Error('桌宠已关闭，请重新打开。'));}pending.clear();
  }
  window.once('closed',dispose);
  return {
    async apply(value){
      const {normalizeAppearance}=await import('../today-palette.js');
      const appearance=value===null?null:normalizeAppearance(value);
      if(value!==null&&!appearance)throw new Error('配色数据无效，请重新取色。');
      if(window.isDestroyed())throw new Error('桌宠已关闭，请重新打开。');
      return new Promise((resolve,reject)=>{
        const id=++serial;
        const timer=setTimeout(()=>{pending.delete(id);reject(new Error('桌宠没有响应，请稍后重试。'));},timeoutMs);
        pending.set(id,{resolve,reject,timer});
        try{window.webContents.send('pet:action',{type:'today-appearance',value:{id,appearance}});}
        catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
      });
    },dispose,
  };
}
module.exports={attachAppearanceIpc};
