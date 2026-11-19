// Short directional impulses keep the feet planted and let the elastic body
// follow through. Forward/back uses real depth instead of translating the sprite.
export function applyExerciseMove(simulation,character,action,side){
  const x=action==='left'?-1:action==='right'?1:0;
  const z=action==='up'?-1:action==='down'?1:0;
  for(let i=8;i<simulation.nodes.length;i++){
    const weight=(i-7)/(simulation.nodes.length-8),node=simulation.nodes[i];
    node.old.x-=x*.014*weight;
    node.old.z-=z*.024*weight;
    if(action==='down')node.old.y+=.006*weight;
    if(action==='up')node.old.y-=.004*weight;
  }
  if(action==='rotate'){
    const direction=side==='left'?-1:1;
    character.userData.exerciseTurn=direction*.6;
    for(const arm of simulation.arms)for(let i=1;i<arm.nodes.length;i++){
      arm.nodes[i].old.z+=direction*arm.sign*.016*i/6;
    }
  }
}

export function updateExerciseTurn(character,dt){
  const target=character.userData.exerciseTurn||0;
  character.rotation.y+=(target-character.rotation.y)*(1-Math.exp(-dt*12));
  character.userData.exerciseTurn=target*Math.exp(-dt*2.3);
}
