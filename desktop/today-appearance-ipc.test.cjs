const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {attachAppearanceIpc}=require('./today-appearance-ipc.cjs');
const palette={version:1,day:'2026-11-20',colors:{skin:'#deb08c',hair:'#4d2c24',shirt:'#d95c43',trousers:'#5b271c'}};
function fixture(onSend,timeoutMs=100){const ipcMain=new EventEmitter(),window=new EventEmitter();window.isDestroyed=()=>false;window.webContents={send:(_channel,message)=>onSend(ipcMain,window,message)};return {relay:attachAppearanceIpc({ipcMain,window,timeoutMs}),ipcMain,window};}
test('apply resolves only after the actual pet renderer acknowledges',async()=>{
  const f=fixture((ipc,win,{value})=>{ipc.emit('pet:appearance-applied',{sender:{}},{id:value.id,error:'forged'});setImmediate(()=>ipc.emit('pet:appearance-applied',{sender:win.webContents},{id:value.id}));});
  await f.relay.apply(palette);f.relay.dispose();
});
test('renderer failure and timeout reach the photo window instead of pretending success',async()=>{
  const f=fixture((ipc,win,{value})=>ipc.emit('pet:appearance-applied',{sender:win.webContents},{id:value.id,error:'保存失败'}));
  await assert.rejects(f.relay.apply(palette),/保存失败/);f.relay.dispose();
  const silent=fixture(()=>{},15);await assert.rejects(silent.relay.apply(palette),/没有响应/);silent.relay.dispose();
});
test('invalid input is rejected before transport; reset sends null',async()=>{
  let sent;const f=fixture((ipc,win,{value})=>{sent=value.appearance;ipc.emit('pet:appearance-applied',{sender:win.webContents},{id:value.id});});
  await assert.rejects(f.relay.apply({photo:'bad'}),/无效/);assert.equal(sent,undefined);
  await f.relay.apply(null);assert.equal(sent,null);f.relay.dispose();
});
