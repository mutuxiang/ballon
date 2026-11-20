import {mountTodayAvatar} from './today-avatar.js';

let applying=false;
const avatar=mountTodayAvatar(document.querySelector('#photo-launcher'),{
  onApply:()=>{
    if(window.desktopPet){applying=true;window.desktopPet.applyTodayAvatar();}
  },
});
document.querySelector('.today-dialog').addEventListener('close',()=>{
  // This is a dedicated Electron window, not the model editor underneath it.
  if(window.desktopPet){if(!applying)window.close();}
  else document.querySelector('#photo-launcher').style.display='block';
});
avatar.open();
