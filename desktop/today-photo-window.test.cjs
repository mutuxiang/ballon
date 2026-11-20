const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createTodayPhotoWindow}=require('./today-photo-window.cjs');

function fixture(){
  const windows=[];let applied=0;
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.webContents={};this.calls=[];windows.push(this);}
    setMenuBarVisibility(){}
    loadFile(file){this.file=file;return Promise.resolve();}
    isDestroyed(){return Boolean(this.destroyed);}
    isMinimized(){return Boolean(this.minimized);}
    restore(){this.calls.push('restore');this.minimized=false;}
    show(){this.calls.push('show');}
    moveTop(){this.calls.push('moveTop');}
    focus(){this.calls.push('focus');}
    close(){this.destroyed=true;this.emit('closed');}
  }
  const parent={getBounds:()=>({x:0,y:0,width:740,height:380})};
  const controller=createTodayPhotoWindow({BrowserWindow:Window,parent,
    screen:{getDisplayMatching:()=>({workArea:{x:100,y:0,width:1280,height:680}})},
    preloadPath:'preload.cjs',pagePath:'dist/photo.html',onApply:()=>applied++,
  });
  return {controller,windows,parent,get applied(){return applied;}};
}
test('opens the dedicated page above the pet, fits work area and shows after loading',async()=>{
  const f=fixture();const window=f.controller.open();await Promise.resolve();
  assert.equal(window.file,'dist/photo.html');assert.equal(window.options.parent,f.parent);
  assert.equal(window.options.show,false);assert.equal(window.options.height,648);
  assert.equal(window.options.x,100+(1280-window.options.width)/2);assert.equal(window.options.y,16);
  assert.deepEqual(window.calls,['show','moveTop','focus']);
});
test('repeated opening restores the existing window; closing allows a fresh window',()=>{
  const f=fixture();const first=f.controller.open();first.minimized=true;
  assert.equal(f.controller.open(),first);assert.equal(f.windows.length,1);
  assert.deepEqual(first.calls,['restore','show','moveTop','focus']);
  f.controller.close();assert.equal(first.destroyed,true);
  assert.notEqual(f.controller.open(),first);assert.equal(f.windows.length,2);
});
test('only the current photo window may apply colors and it stays open until acknowledged',async()=>{
  const f=fixture();const window=f.controller.open();
  await assert.rejects(f.controller.apply({}));assert.equal(f.applied,0);
  assert.deepEqual(await f.controller.apply(window.webContents,{colors:{}}),{ok:true});assert.equal(f.applied,1);
  assert.equal(window.isDestroyed(),false);f.controller.close();await assert.rejects(f.controller.apply(window.webContents));
});
