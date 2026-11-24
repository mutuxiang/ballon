import './pet-tasks.css';
export function mountPetTasks(progress,{anchor}){
  const bubble=document.createElement('aside');bubble.className='pet-task-bubble';bubble.hidden=true;bubble.setAttribute('aria-label','小人的运动任务');
  bubble.innerHTML=`<div class="pet-task-intro"><p class="pet-task-message" role="status" aria-live="polite">完成任务，解锁新皮肤</p></div>
    <section class="pet-task-work"><div class="pet-task-row"><span class="pet-task-action"></span><span class="pet-task-reward"></span></div>
      <div class="pet-task-numbers"><strong class="pet-task-done"></strong><span class="pet-task-total"></span></div>
      <progress class="pet-task-progress" aria-label="当前任务完成进度"></progress></section>
    <footer><div class="pet-task-row"><span>新皮肤解锁</span><span class="pet-task-xp"></span></div><progress class="pet-task-unlock" max="100" value="0" aria-label="皮肤解锁经验"></progress></footer>`;
  document.body.append(bubble);
  const $=selector=>bubble.querySelector(selector),message=$('.pet-task-message'),xp=$('.pet-task-xp'),bar=$('.pet-task-unlock');
  let until=0,nextReminder=Date.now()+45000,previous=progress.state,started=false;
  function show(text){message.textContent=text;bubble.hidden=false;until=Date.now()+10000;nextReminder=Date.now()+45000;}
  function render(state){
    const next=100,completed=state.completed>previous.completed;
    const task=state.task||(completed?previous.task:null);
    xp.textContent=state.xp+' / '+next+' 经验';bar.max=next;bar.value=Math.min(state.xp,next);
    if(task){
      const current=completed?task.target:Math.min(task.target,Math.floor(task.current));
      $('.pet-task-action').textContent=task.metric==='steps'?'左右交替踩踏':'交替踩踏计时';
      $('.pet-task-reward').textContent=(completed?'已获得 +':'完成 +')+task.reward+' 经验';
      $('.pet-task-done').textContent=current;
      $('.pet-task-total').textContent='/ '+task.target+' '+task.unit+'已完成';
      $('.pet-task-progress').max=task.target;$('.pet-task-progress').value=current;
    }
    if(completed)show(state.xp>=next?'新皮肤解锁资格到手！':'任务完成，经验到账！');
    else if(state.task&&!previous.task)show('完成任务，解锁新皮肤');
    previous=state;
  }
  progress.subscribe(render);
  const timer=setInterval(()=>{
    if(document.hidden){bubble.hidden=true;return;}
    if(Date.now()>=nextReminder){started=true;progress.tick();if(progress.state.task)show('完成任务，解锁新皮肤');else nextReminder=Date.now()+45000;}
    if(started)progress.tick();
    if(Date.now()>until)bubble.hidden=true;
    if(!bubble.hidden){const point=anchor(),width=bubble.offsetWidth,height=bubble.offsetHeight;
      bubble.style.left=Math.max(8,Math.min(innerWidth-width-8,point.x-width/2))+'px';
      bubble.style.top=Math.max(8,Math.min(innerHeight-height-16,point.y-height-28))+'px';}
  },250);
  addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  return bubble;
}
