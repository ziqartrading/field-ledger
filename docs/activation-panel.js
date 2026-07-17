(function(){
  'use strict';
  let wasOpen=false;
  function usersOpen(){
    const view=document.getElementById('usersView');
    return !!(view&&view.classList.contains('active'));
  }
  function loadCode(force){
    if(!usersOpen()||typeof flRenderActivationAdmin!=='function')return;
    Promise.resolve(flRenderActivationAdmin(!!force)).catch(function(error){
      const status=document.getElementById('flAdminActivationCount');
      if(status)status.textContent=error&&error.message||'Code could not load. Tap Load / refresh code.';
    });
  }
  document.addEventListener('click',function(event){
    const refresh=event.target.closest&&event.target.closest('#flRefreshActivationCode');
    if(refresh){event.preventDefault();loadCode(true);return;}
    if(event.target.closest&&event.target.closest('#usersBtn,#umUsers,#alUsers,[data-fl-users]'))setTimeout(function(){loadCode(true);},0);
  },true);
  const view=document.getElementById('usersView');
  if(view&&typeof MutationObserver==='function')new MutationObserver(function(){
    const open=usersOpen();
    if(open&&!wasOpen)loadCode(true);
    wasOpen=open;
  }).observe(view,{attributes:true,attributeFilter:['class']});
  addEventListener('load',function(){wasOpen=usersOpen();if(wasOpen)loadCode(true);});
}());
