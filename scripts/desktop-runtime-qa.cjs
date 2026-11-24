const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const outputDir=path.resolve(__dirname,'../output/runtime-qa');
fs.mkdirSync(outputDir,{recursive:true});
app.setPath('userData',path.join(app.getPath('temp'),'ballon-runtime-qa'));
const baseline=process.argv.includes('--baseline');
const timeout=setTimeout(()=>{console.error('Desktop runtime QA timed out');app.exit(1);},85000);
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
    if(process.argv.includes('--scoreboard')){
      const game=new BrowserWindow({width:1120,height:760,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
      await game.loadFile(path.resolve(__dirname,'../dist/play.html'));await sleep(1200);await game.webContents.executeJavaScript('document.fonts.ready');
      for(const width of [1120,420]){
        game.setSize(width,760);await sleep(300);
        const info=await game.webContents.executeJavaScript(`(()=>{const el=document.querySelector('.scoreboard'),r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,font:getComputedStyle(document.querySelector('#score')).fontFamily,loaded:document.fonts.check('27px PuffoScoreComic')};})()`);
        assert.ok(info.left>=0&&info.right<=info.width);assert.ok(info.loaded);assert.ok(info.font.includes('PuffoScoreComic'));
        fs.writeFileSync(path.join(outputDir,'scoreboard-'+width+'.png'),(await game.webContents.capturePage()).toPNG());console.log(JSON.stringify(info));
      }
      clearTimeout(timeout);app.quit();return;
    }
    if(process.argv.includes('--motion')){
      await pet.webContents.executeJavaScript("window.dancer.selectTheme('none');document.querySelector('#play').click()");
      const states=[];
      const simulate=async(state,steps,name)=>{
        const result=await pet.webContents.executeJavaScript(`(()=>{
          const s=window.dancer.simulation;${state?`s.setState(${JSON.stringify(state)});`:''}
          for(let i=0;i<${steps};i++)s.step(1/120);s.deform();
          return {name:${JSON.stringify(name)},head:s.nodes[24].p.y,pressure:s.nodes[24].pressure};
        })()`);await sleep(120);states.push(result);
        fs.writeFileSync(path.join(outputDir,'motion-'+name+'.png'),(await pet.webContents.capturePage()).toPNG());return result;
      };
      assert.ok((await simulate('high',1000,'full')).head>4);
      await simulate('none',120,'fall-1s');await simulate(null,240,'fall-3s');
      const flat=await simulate(null,600,'empty');assert.ok(flat.head<1.4);assert.ok(flat.pressure<.01);
      assert.ok((await simulate('low',720,'single-pedal')).head>2);
      assert.ok((await simulate('high',720,'refilled')).head>4);
      console.log(JSON.stringify({states}));clearTimeout(timeout);app.quit();return;
    }
    if(process.argv.includes('--tasks')){
      await pet.webContents.executeJavaScript("localStorage.removeItem('puffo-pump-skin-tasks-v2');location.reload()");await sleep(2000);
      if(process.argv.includes('--fast-tasks'))await pet.webContents.executeJavaScript('(()=>{const realNow=Date.now;Date.now=()=>realNow()+45000;})()');
      await sleep(process.argv.includes('--fast-tasks')?1000:45000);
      assert.equal(await pet.webContents.executeJavaScript("document.querySelector('.pet-task-bubble').hidden"),false);
      fs.writeFileSync(path.join(outputDir,'task-bubble.png'),(await pet.webContents.capturePage()).toPNG());
      assert.equal(await pet.webContents.executeJavaScript("document.querySelector('[role=progressbar]').style.display"),'none');
      if(process.argv.includes('--task-layouts')){
        const layouts=[];
        for(const theme of ['none','fishing','breathe','fresh','tea','wind']){
          await pet.webContents.executeJavaScript(`window.dancer.selectTheme('${theme}')`);await sleep(550);
          const rect=await pet.webContents.executeJavaScript(`(()=>{const el=document.querySelector('.pet-task-bubble'),r=el.getBoundingClientRect();return {theme:'${theme}',x:r.x,y:r.y,width:r.width,height:r.height,hidden:el.hidden,font:document.fonts.check('14px PuffoTaskComic')};})()`);
          assert.equal(rect.hidden,false);assert.ok(rect.x>=0&&rect.y>=0);assert.ok(rect.font);layouts.push(rect);
          fs.writeFileSync(path.join(outputDir,'task-layout-'+theme+'.png'),(await pet.webContents.capturePage()).toPNG());
        }
        console.log(JSON.stringify({layouts}));clearTimeout(timeout);app.quit();return;
      }
      for(let i=0;i<20;i++){
        const side=i%2?'right':'left';pet.webContents.send('pet:action',{type:'pedal',value:{side,down:true}});
        pet.webContents.send('pet:action',{type:'pedal',value:{side,down:false}});await pet.webContents.executeJavaScript("Promise.resolve()");await sleep(300);
        if(i===4)assert.equal(await pet.webContents.executeJavaScript("document.querySelector('[role=progressbar]').style.display"),'none');
        if(i%4===3)pet.webContents.send('pet:action',{type:'focus-end'});
      }
      const read=()=>pet.webContents.executeJavaScript("JSON.parse(localStorage.getItem('puffo-pump-skin-tasks-v2'))");
      console.log('Task completion',JSON.stringify(await read()));assert.equal((await read()).xp,20);
      fs.writeFileSync(path.join(outputDir,'task-completed.png'),(await pet.webContents.capturePage()).toPNG());
      await pet.webContents.executeJavaScript('window.desktopPet.menu()');await sleep(500);
      const menu=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('pet-menu.html'));
      await menu.webContents.executeJavaScript("document.querySelector('[data-panel=themes]').click()");await sleep(200);
      const slots=await menu.webContents.executeJavaScript('window.petMenu.state().then(s=>s.unlocks)');assert.equal(slots.length,1);assert.equal(slots[0].current,20);assert.equal(slots[0].achieved,false);
      fs.writeFileSync(path.join(outputDir,'skin-task-menu.png'),(await menu.webContents.capturePage()).toPNG());
      await pet.webContents.executeJavaScript("const key='puffo-pump-skin-tasks-v2';const s=JSON.parse(localStorage.getItem(key));s.task={index:1,current:0};localStorage.setItem(key,JSON.stringify(s));window.dispatchEvent(new StorageEvent('storage',{key}));");
      await menu.webContents.executeJavaScript("document.querySelector('[data-action=exercise]').click()");await sleep(1200);
      const exercise=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('play.html'));
      await exercise.webContents.executeJavaScript("document.querySelector('#coach-action').click()");
      for(let i=0;i<8;i++){await exercise.webContents.executeJavaScript(`window.airWorkerGame.setPedal('${i%2?'right':'left'}',true);window.airWorkerGame.setPedal('${i%2?'right':'left'}',false)`);await sleep(400);}
      exercise.close();await sleep(400);assert.ok((await read()).task.current>=3);
      console.log(JSON.stringify({slots,progress:await read()}));clearTimeout(timeout);app.quit();return;
    }
    if(process.argv.includes('--wind')){
      await pet.webContents.executeJavaScript("window.dancer.selectTheme('wind');window.dancer.simulation.setState('high')");
      await sleep(3000);
      const wind=await pet.webContents.executeJavaScript(`(()=>{
        const dancer=window.dancer,root=dancer.themeSkins,kite=dancer.scene.parent.getObjectByName('Theme_cell_wind_1');
        return {status:root.status,height:kite.scale.y,cropBottom:kite.material.map.offset.y,
          noLeaves:!dancer.scene.parent.getObjectByName('Theme_cell_wind_7'),noWind:!dancer.scene.parent.getObjectByName('Theme_cell_wind_8')};
      })()`);
      assert.equal(wind.status,'ready');assert.ok(Math.abs(wind.height-1.95)<1e-6);assert.ok(wind.cropBottom>=.72&&wind.cropBottom<.75);assert.ok(wind.noLeaves&&wind.noWind);
      fs.writeFileSync(path.join(outputDir,'wind-skin.png'),(await pet.webContents.capturePage()).toPNG());
      console.log(JSON.stringify(wind));clearTimeout(timeout);app.quit();return;
    }
    const petTiming=await sample(pet);
    await pet.webContents.executeJavaScript('window.desktopPet.menu()');await sleep(700);
    const menu=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('pet-menu.html'));
    assert.ok(menu,'custom pet menu opens');
    assert.deepEqual(await menu.webContents.executeJavaScript("Array.from(document.querySelectorAll('.entry'),button=>button.textContent.replace(/[↗✎◈↔⏻›]/g,'').trim())"),['打开运动模式','自定义','换皮肤','桌宠大小','退出桌宠']);
    fs.writeFileSync(path.join(outputDir,'ballon-menu.png'),(await menu.webContents.capturePage()).toPNG());
    await menu.webContents.executeJavaScript("document.querySelector('[data-panel=themes]').click()");await sleep(400);
    assert.equal(await menu.webContents.executeJavaScript("document.querySelectorAll('#themes .theme-mini').length"),6);
    fs.writeFileSync(path.join(outputDir,'skin-menu.png'),(await menu.webContents.capturePage()).toPNG());
    if(process.argv.includes('--colors')){
      await menu.webContents.executeJavaScript("document.querySelector('[data-panel=custom]').click();document.querySelector('[data-action=custom]').click()");await sleep(1000);
      const photo=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('photo.html'));assert.ok(photo);
      const waitState=async state=>{for(let i=0;i<100;i++){if(await photo.webContents.executeJavaScript(`document.querySelector('.today-dialog').dataset.state===${JSON.stringify(state)}`))return;await sleep(100);}throw new Error('Photo state timeout: '+state);};
      await photo.webContents.executeJavaScript(`new Promise(resolve=>{
        const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
        ctx.fillStyle='#F5C2C5';ctx.fillRect(0,0,512,260);ctx.fillStyle='#629FA1';ctx.fillRect(0,260,512,252);
        canvas.toBlob(blob=>{const file=new File([blob],'palette-test.png',{type:'image/png'}),data=new DataTransfer();data.items.add(file);
          const input=document.querySelector('.today-file');input.files=data.files;input.dispatchEvent(new Event('change'));resolve();});
      })`);
      await waitState('photo');await photo.webContents.executeJavaScript("document.querySelector('.today-primary').click()");await waitState('ready');
      const editResult=await photo.webContents.executeJavaScript(`(()=>{
        const $=s=>document.querySelector(s),outer=$('[data-part=outer]'),initial=outer.querySelector('i').style.backgroundColor;
        const otherColors=Array.from(document.querySelectorAll('[data-part]:not([data-part=outer]) i'),i=>i.style.backgroundColor);
        if(document.querySelector('input[type=color],input[type=range],.today-hex'))throw new Error('Advanced color controls remain');
        if(document.querySelectorAll('[data-part]').length!==5)throw new Error('Missing parts');
        const preview=$('.today-preview').getBoundingClientRect(),parts=$('.today-parts').getBoundingClientRect();
        if(preview.bottom>parts.top)throw new Error('Original stacked layout changed');
        outer.click();const options=Array.from(document.querySelectorAll('[data-preset]'),b=>b.dataset.preset);
        const detected=$('[data-preset][aria-label="识别原色"]').dataset.preset;
        $('[data-preset]').click();if(outer.querySelector('i').style.backgroundColor===initial)throw new Error('Tone did not change');
        outer.click();if(JSON.stringify(options)!==JSON.stringify(Array.from(document.querySelectorAll('[data-preset]'),b=>b.dataset.preset)))throw new Error('Palette drifted from detected color');
        $('.today-color-reset').click();if(outer.querySelector('i').style.backgroundColor!==initial)throw new Error('Reset failed');
        outer.click();const chosen=document.querySelector('.today-presets button:last-child'),chosenHex=chosen.dataset.preset;chosen.click();
        if(JSON.stringify(otherColors)!==JSON.stringify(Array.from(document.querySelectorAll('[data-part]:not([data-part=outer]) i'),i=>i.style.backgroundColor)))throw new Error('Other parts changed');
        return {initial,detected,chosenHex,chosen:outer.querySelector('i').style.backgroundColor,stacked:true};
      })()`);
      fs.writeFileSync(path.join(outputDir,'color-editor.png'),(await photo.webContents.capturePage()).toPNG());
      photo.setSize(560,640);await sleep(300);await photo.webContents.executeJavaScript("document.querySelector('.today-dialog').scrollTop=0");
      const layout=await photo.webContents.executeJavaScript(`(()=>{const e=document.querySelector('.today-color-editor').getBoundingClientRect(),d=document.querySelector('.today-dialog');return {left:e.left,right:e.right,width:innerWidth,scroll:d.scrollHeight,visible:d.clientHeight};})()`);
      assert.ok(layout.left>=0&&layout.right<=layout.width,'editor must fit narrow windows');
      fs.writeFileSync(path.join(outputDir,'color-editor-narrow.png'),(await photo.webContents.capturePage()).toPNG());
      await photo.webContents.executeJavaScript("document.querySelector('.today-primary').click()");await sleep(1200);
      assert.equal(await pet.webContents.executeJavaScript('window.dancer.scene.userData.todayAppearance.colors.outer.toUpperCase()'),editResult.chosenHex);
      console.log(JSON.stringify({editResult,layout,applied:true}));clearTimeout(timeout);app.quit();return;
    }
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
