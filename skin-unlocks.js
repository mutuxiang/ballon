export const SKIN_PROGRESS_KEY='puffo-pump-skin-tasks-v2';
const TASKS=[
  {text:'陪我左右交替踩 12 次吧！',metric:'steps',target:12,reward:20,unit:'次'},
  {text:'再一起交替踩 20 次，好吗？',metric:'steps',target:20,reward:30,unit:'次'},
  {text:'陪我活动 30 秒，慢慢来～',metric:'seconds',target:30,reward:40,unit:'秒'}
];
const finite=n=>Number.isFinite(n)?Math.max(0,n):0;
function normalize(value){
  const completed=Math.floor(finite(value?.completed));
  const task=value?.task&&value.task.index===completed%TASKS.length?{index:completed%TASKS.length,current:Math.min(finite(value.task.current),TASKS[completed%TASKS.length].target)}:null;
  return {version:2,completed,xp:Math.floor(completed/3)*90+[0,20,50][completed%3],task,nextAt:finite(value?.nextAt)};
}
export function createSkinUnlockProgress({read=()=>null,write=()=>{},now=()=>Date.now()}={}){
  let stats=normalize(null),lastSide=null,lastTime=-Infinity;const held=new Set(),listeners=new Set();
  function refresh(){try{const saved=normalize(read());if(saved.completed>stats.completed||(saved.completed===stats.completed&&(!stats.task||saved.task?.current>=stats.task.current)))stats=saved;}catch{}}
  const snapshot=()=>({...stats,task:stats.task?{...TASKS[stats.task.index],...stats.task}:null});
  const slots=()=>[100].map((target,i)=>({id:['stride','energy','habit'][i],name:'神秘皮肤',target,current:stats.xp,achieved:stats.xp>=target,placeholder:true}));
  const notify=()=>listeners.forEach(listener=>listener(snapshot()));
  function save(){try{write({...stats,task:stats.task?{...stats.task}:null});}catch{}notify();}
  refresh();
  return {
    get state(){return snapshot();},get slots(){return slots();},
    refresh(){refresh();notify();},subscribe(listener){listeners.add(listener);listener(snapshot());return ()=>listeners.delete(listener);},
    tick(){refresh();if(!stats.task&&now()>=stats.nextAt){stats.task={index:stats.completed%TASKS.length,current:0};save();}},
    resetInput(){held.clear();lastSide=null;lastTime=-Infinity;},
    record(side,down,time){
      if(!['left','right'].includes(side)||!Number.isFinite(time))return;
      if(!down){held.delete(side);return;}if(held.has(side))return;held.add(side);
      const gap=time-lastTime,valid=lastSide!==null&&side!==lastSide&&gap>=.12&&gap<=2.5;
      lastSide=side;lastTime=time;if(!valid)return;refresh();if(!stats.task)return;
      const task=TASKS[stats.task.index];stats.task.current+=task.metric==='steps'?1:gap;
      if(stats.task.current>=task.target){stats.completed++;stats.xp+=task.reward;stats.task=null;stats.nextAt=now()+45000;}
      save();
    }
  };
}
export function mountSkinUnlockProgress(){
  const progress=createSkinUnlockProgress({read:()=>JSON.parse(localStorage.getItem(SKIN_PROGRESS_KEY)||'null'),write:value=>localStorage.setItem(SKIN_PROGRESS_KEY,JSON.stringify(value))});
  addEventListener('storage',event=>{if(event.key===SKIN_PROGRESS_KEY)progress.refresh();});
  document.addEventListener('visibilitychange',()=>{progress.resetInput();if(!document.hidden)progress.refresh();});
  addEventListener('blur',()=>progress.resetInput());
  return progress;
}
