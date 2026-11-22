const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const outputDir=path.resolve(__dirname,'../output/runtime-qa');
fs.mkdirSync(outputDir,{recursive:true});
app.setPath('userData',path.join(app.getPath('temp'),'ballon-runtime-qa'));
const baseline=process.argv.includes('--baseline');
const timeout=setTimeout(()=>{console.error('Desktop runtime QA timed out');app.exit(1);},65000);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sample=window=>window.webContents.executeJavaScript(`new Promise(resolve=>{
  const intervals=[];let previous=performance.now();
  function frame(now){intervals.push(now-previous);previous=now;
    if(intervals.length<120)requestAnimationFrame(frame);else{
      intervals.shift();intervals.sort((a,b)=>a-b);
      resolve({medianMs:intervals[Math.floor(intervals.length*.5)],p95Ms:intervals[Math.floor(intervals.length*.95)],hidden:document.hidden});
    }}requestAnimationFrame(frame);
})`);
require('../desktop/main.cjs');
app.whenReady().then(async()=>{
  try{
    await sleep(3000);
    const pet=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('index.html'));
    assert.ok(pet,'pet loaded');
    const petTiming=await sample(pet);
    await pet.webContents.executeJavaScript('window.desktopPet.menu()');await sleep(700);
    const menu=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('pet-menu.html'));
    assert.ok(menu,'custom pet menu opens');
    assert.deepEqual(await menu.webContents.executeJavaScript("Array.from(document.querySelectorAll('.entry'),button=>button.textContent.replace(/[↗✎◈↔⏻›]/g,'').trim())"),['打开运动模式','自定义','换皮肤','桌宠大小','退出桌宠']);
    fs.writeFileSync(path.join(outputDir,'ballon-menu.png'),(await menu.webContents.capturePage()).toPNG());
    await menu.webContents.executeJavaScript("document.querySelector('[data-panel=sizes]').click()");await sleep(200);
    assert.equal(await menu.webContents.executeJavaScript("document.querySelector('#sizes [aria-pressed=true]').textContent"),'100% · 默认');
    await menu.webContents.executeJavaScript("document.querySelector('[data-action=exercise]').click()");
    await sleep(3000);
    const game=BrowserWindow.getAllWindows().find(w=>w!==pet&&w.webContents.getURL().includes('play.html'));
    assert.ok(game,'game loaded');
    const gameTools=await game.webContents.executeJavaScript("Array.from(document.querySelectorAll('.tools button'),button=>button.id)");
    assert.deepEqual(gameTools,['pause'],'exercise only exposes pause');
    assert.equal(await game.webContents.executeJavaScript("document.querySelector('.theme-picker')===null"),true);
    if(!baseline){
      assert.equal(pet.isVisible(),false);assert.equal(game.isFullScreen(),false);assert.equal(game.isMaximized(),true);
      assert.equal(await game.webContents.executeJavaScript('document.fullscreenElement===null'),true,'keep the taskbar with ordinary maximization');
      assert.equal(game.isFullScreen(),false);
      assert.equal(await pet.webContents.executeJavaScript('document.hidden'),true);
      app.emit('second-instance');await sleep(100);
      assert.equal(pet.isVisible(),false,'reopening the app must not reveal the pet during play');
      assert.equal(BrowserWindow.getAllWindows().length,2,'reuse the existing game window');
    }
    await sleep(500);
    const coachLayout=await game.webContents.executeJavaScript(`(()=>{
      const coach=document.querySelector('#coach'),rect=coach.getBoundingClientRect();
      return {placement:coach.dataset.placement,left:rect.left,right:rect.right,width:innerWidth,
        buttonColor:getComputedStyle(document.querySelector('#coach-action')).backgroundColor};
    })()`);
    assert.equal(coachLayout.placement,'right','guidance stays to the right of the ring');
    assert.ok(coachLayout.right<=coachLayout.width-16,'bubble remains inside the window');
    assert.equal(coachLayout.buttonColor,'rgb(255, 219, 36)');
    fs.writeFileSync(path.join(outputDir,'ballon-ready.png'),(await game.webContents.capturePage()).toPNG());
    await game.webContents.executeJavaScript("document.querySelector('#coach-action').click()");
    const gameTiming=await sample(game);
    if(process.argv.includes('--barrage'))await game.webContents.executeJavaScript("new Promise(resolve=>{const timer=setInterval(()=>{if(window.airWorkerGame.state.time>=25){clearInterval(timer);resolve();}},100);})");
    const screenshot=await game.webContents.capturePage();
    fs.writeFileSync(path.join(outputDir,baseline?'ballon-before.png':'ballon-after.png'),screenshot.toPNG());
    const result={petTiming,gameTiming,coachLayout,petVisibleDuringGame:pet.isVisible(),fullscreen:game.isFullScreen(),maximized:game.isMaximized(),bounds:game.getBounds(),gpu:app.getGPUFeatureStatus()};
    game.close();await sleep(500);
    if(!baseline){
      assert.equal(pet.isVisible(),true,'pet restored on game close');
      assert.equal(await pet.webContents.executeJavaScript('document.hidden'),false);
    }
    fs.writeFileSync(path.join(outputDir,baseline?'ballon-before.json':'ballon-after.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));clearTimeout(timeout);app.quit();
  }catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}
});
