import {mountTodayAvatar} from './today-avatar.js';

const avatar=mountTodayAvatar(document.querySelector('#photo-launcher'),{
  onApply:async appearance=>{
    if(!window.desktopPet)throw new Error('请从桌宠右键菜单打开此页面，再应用配色。');
    await window.desktopPet.applyTodayAvatar(appearance);
  },
});
document.querySelector('.today-dialog').addEventListener('close',()=>{
  // This is a dedicated Electron window, not the model editor underneath it.
  if(window.desktopPet)window.close();
  else document.querySelector('#photo-launcher').style.display='block';
});
avatar.open();
