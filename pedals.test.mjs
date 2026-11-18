import assert from 'node:assert/strict';
import {createPedals} from './pedals.js';
const states=[],beats=[];const p=createPedals({onState:s=>states.push(s),onBeat:b=>beats.push(b)});
p.reset();p.set('left',true,0);p.set('left',true,20);p.set('right',true,100);p.set('left',false,200);p.set('right',false,300);
assert.deepEqual(states,['none','low','high','low','none']);assert.equal(beats.length,4);p.set('left',true,400);p.set('right',true,500);assert.equal(beats.at(-1).combo,4);p.reset();assert.equal(states.at(-1),'none');console.log('Pedal hold, release, repeat and alternating input passed');
