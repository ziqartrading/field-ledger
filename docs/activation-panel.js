(function(){
  'use strict';
  const PASSWORD_MIN_LENGTH=12;
  let wasOpen=false;

  function text(en,ps){return typeof LANG!=='undefined'&&LANG==='ps'?ps:en;}
  function usersOpen(){
    const view=document.getElementById('usersView');
    return !!(view&&view.classList.contains('active'));
  }
  function loadCode(force){
    if(!usersOpen())return;
    const loader=typeof flRefreshUsersAndCode==='function'?flRefreshUsersAndCode:(typeof flRenderActivationAdmin==='function'?flRenderActivationAdmin:null);
    if(!loader)return;
    Promise.resolve(loader(!!force)).catch(function(error){
      const status=document.getElementById('flAdminActivationCount');
      if(status)status.textContent=error&&error.message||'Code could not load. Tap Load / refresh code.';
    });
  }

  function passwordChecks(password){
    const value=String(password||'');
    return {
      length:value.length>=PASSWORD_MIN_LENGTH,
      uppercase:/[A-Z]/.test(value),
      lowercase:/[a-z]/.test(value),
      number:/[0-9]/.test(value)
    };
  }
  function passwordLabels(){
    return typeof LANG!=='undefined'&&LANG==='ps'?{
      length:'لږ تر لږه ۱۲ توري',
      uppercase:'لږ تر لږه یو لوی انګلیسي توری (A–Z)',
      lowercase:'لږ تر لږه یو کوچنی انګلیسي توری (a–z)',
      number:'لږ تر لږه یوه شمېره (0–9)'
    }:{
      length:'at least 12 characters',
      uppercase:'at least one uppercase letter (A–Z)',
      lowercase:'at least one lowercase letter (a–z)',
      number:'at least one number (0–9)'
    };
  }
  function missingPasswordRules(password){
    const checks=passwordChecks(password),labels=passwordLabels();
    return Object.keys(checks).filter(function(key){return !checks[key];}).map(function(key){return labels[key];});
  }
  function passwordError(password){
    const missing=missingPasswordRules(password);
    if(!missing.length)return '';
    return typeof LANG!=='undefined'&&LANG==='ps'?'پاسورډ کې دا شرطونه نشته: '+missing.join('، ')+'.':'Password is missing: '+missing.join(', ')+'.';
  }
  function passwordSummary(){
    const labels=passwordLabels();
    return typeof LANG!=='undefined'&&LANG==='ps'?'خوندي پاسورډ باید '+labels.length+'، '+labels.uppercase+'، '+labels.lowercase+' او '+labels.number+' ولري.':'A secure password must contain '+labels.length+', '+labels.uppercase+', '+labels.lowercase+', and '+labels.number+'.';
  }
  function renderPasswordPolicy(input,container){
    if(!input||!container)return;
    const checks=passwordChecks(input.value),labels=passwordLabels();
    container.innerHTML='<div class="fl-password-policy-title">'+text('Password must meet every requirement:','پاسورډ باید دا ټول شرطونه پوره کړي:')+'</div>'+Object.keys(checks).map(function(key){
      return '<div class="fl-password-rule '+(checks[key]?'ok':'missing')+'"><span>'+(checks[key]?'✓':'○')+'</span><b>'+labels[key]+'</b></div>';
    }).join('');
    input.setAttribute('aria-invalid',missingPasswordRules(input.value).length?'true':'false');
  }
  function ensurePasswordPolicy(inputId,containerId){
    const input=document.getElementById(inputId);
    if(!input)return null;
    input.minLength=PASSWORD_MIN_LENGTH;
    let container=document.getElementById(containerId);
    if(!container){
      container=document.createElement('div');
      container.id=containerId;
      container.className='fl-password-policy';
      container.setAttribute('aria-live','polite');
      input.insertAdjacentElement('afterend',container);
    }
    if(!input.dataset.passwordGuidanceInstalled){
      input.dataset.passwordGuidanceInstalled='1';
      input.addEventListener('input',function(){renderPasswordPolicy(input,container);});
    }
    renderPasswordPolicy(input,container);
    return container;
  }
  function installPasswordStyles(){
    if(document.getElementById('flPasswordGuidanceStyles'))return;
    const style=document.createElement('style');
    style.id='flPasswordGuidanceStyles';
    style.textContent='.fl-password-policy{margin-top:8px;padding:10px 11px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);display:grid;gap:5px}.fl-password-policy-title{font-size:var(--fl-fs-11_5,11.5px);font-weight:700;color:var(--soft);margin-bottom:1px}.fl-password-rule{display:flex;align-items:flex-start;gap:7px;font-size:var(--fl-fs-11_5,11.5px);line-height:1.35}.fl-password-rule span{width:15px;flex:0 0 15px;font-weight:800}.fl-password-rule b{font-weight:600}.fl-password-rule.ok{color:#237a4a}.fl-password-rule.missing{color:var(--soft)}';
    document.head.appendChild(style);
  }
  function setAccountError(message){
    if(typeof flSetAccountError==='function'){flSetAccountError(message);return;}
    const box=document.getElementById('acError');
    if(box){box.textContent=message||'';box.classList.toggle('show',!!message);}
  }
  function setChangeError(message){
    if(typeof flSetPasswordError==='function'){flSetPasswordError(message);return;}
    const box=document.getElementById('flPasswordError');
    if(box){box.textContent=message||'';box.classList.toggle('show',!!message);}
  }

  async function submitNewAccountSecurely(event){
    event.preventDefault();event.stopImmediatePropagation();
    if(flAccountCreateBusy||!needPerm('manageUsers'))return;
    const name=document.getElementById('acName').value.trim();
    const username=document.getElementById('acUser').value.trim();
    const password=document.getElementById('acPass').value;
    const role=(!isAdmin()&&document.getElementById('acRole').value==='admin')?'viewer':document.getElementById('acRole').value;
    const save=document.getElementById('acSave');
    setAccountError('');
    if(!name||!username||!password){setAccountError(t('fillAll'));(!name?document.getElementById('acName'):!username?document.getElementById('acUser'):document.getElementById('acPass')).focus();return;}
    const problem=passwordError(password);
    if(problem){setAccountError(problem);document.getElementById('acPass').focus();return;}
    flAccountCreateBusy=true;save.disabled=true;save.classList.add('is-loading');save.textContent=text('Creating account…','حساب جوړېږي…');
    try{
      const result=await api('createUser',{name:name,username:username,password:password,role:role},{timeout:20000});
      await flApplyUserDirectory(result,{requiredUser:result.user});closeScrim();renderUsers();toast(t('accountCreated'));
      loadUsers().then(function(){if(document.getElementById('usersView').classList.contains('active'))renderUsers();}).catch(function(error){console.warn('post-create user refresh',error);});
    }catch(error){
      const message=error.code==='USER_EXISTS'?t('userExists'):error.code==='WEAK_PASSWORD'?(passwordError(password)||error.message||passwordSummary()):error.code==='SERVER_BUSY'?text('Google is finishing another save. Please press Create account again in a moment.','ګوګل لا هم پخواني معلومات خوندي کوي. څو شېبې وروسته بیا Create account ووهئ.'):(error.message||'Account could not be created.');
      setAccountError(message);
    }finally{
      flAccountCreateBusy=false;save.disabled=false;save.classList.remove('is-loading');save.textContent=t('createAccount');
    }
  }

  async function submitPasswordChangeSecurely(event){
    event.preventDefault();event.stopImmediatePropagation();
    if(flPasswordBusy||!currentUser||!isAdmin())return;
    const target=ACCOUNTS.find(function(user){return String(user.id)===String(flPasswordTargetId);});
    const password=document.getElementById('flPasswordNew').value;
    const confirmation=document.getElementById('flPasswordConfirm').value;
    const save=document.getElementById('flPasswordSave');
    if(!target){setChangeError(text('User was not found. Reload the account list.','کارن ونه موندل شو. د حسابونو لړ بیا پرانیزئ.'));return;}
    const problem=passwordError(password);
    if(problem){setChangeError(problem);document.getElementById('flPasswordNew').focus();return;}
    if(password!==confirmation){setChangeError(text('The two passwords do not match.','دواړه پاسورډونه یو شان نه دي.'));document.getElementById('flPasswordConfirm').focus();return;}
    if(!navigator.onLine||!backendToken){setChangeError(text('Connect to the internet to change a password securely.','د پاسورډ د خوندي بدلون لپاره انټرنېټ سره وصل شئ.'));return;}
    flPasswordBusy=true;save.disabled=true;save.classList.add('is-loading');save.textContent=text('Applying…','پلي کېږي…');setChangeError('');
    try{
      const selfChange=String(target.id)===String(currentUser.id),meta=await getMeta();
      const result=await api('changePassword',{userId:target.id,password:password,deviceId:meta.deviceId},{timeout:20000});
      await flApplyUserDirectory(result,{requiredUser:target});
      if(selfChange)await flRememberOfflineLogin(currentUser.username,password,currentUser);
      flPasswordTargetId=null;closeScrim();renderUsers();
      toast(selfChange?text('Your password was changed. This session remains signed in.','ستاسو پاسورډ بدل شو. دا ناسته لا هم ننوتلې ده.'):text('Password changed · '+(Number(result.revoked)||0)+' existing sessions signed out','پاسورډ بدل شو · '+(Number(result.revoked)||0)+' ناستې ووتلې'));
    }catch(error){
      setChangeError(error.code==='WEAK_PASSWORD'?(passwordError(password)||error.message||passwordSummary()):(error.message||text('Password could not be changed.','پاسورډ بدل نه شو.')));
    }finally{
      flPasswordBusy=false;save.disabled=false;save.classList.remove('is-loading');save.textContent=text('Apply password','پاسورډ پلي کړئ');
    }
  }

  function installPasswordGuidance(){
    installPasswordStyles();
    const createInput=document.getElementById('acPass');
    const changeInput=document.getElementById('flPasswordNew');
    const confirmInput=document.getElementById('flPasswordConfirm');
    ensurePasswordPolicy('acPass','acPasswordPolicy');
    ensurePasswordPolicy('flPasswordNew','flPasswordChangePolicy');
    if(confirmInput)confirmInput.minLength=PASSWORD_MIN_LENGTH;

    const accountForm=document.getElementById('acctForm');
    if(accountForm&&typeof flSubmitNewAccount==='function'){
      accountForm.removeEventListener('submit',flSubmitNewAccount,true);
      accountForm.addEventListener('submit',submitNewAccountSecurely,true);
    }
    const changeForm=document.getElementById('flPasswordForm');
    if(changeForm&&typeof flSubmitPasswordChange==='function'){
      changeForm.removeEventListener('submit',flSubmitPasswordChange,true);
      changeForm.addEventListener('submit',submitPasswordChangeSecurely,true);
    }
    if(createInput)createInput.addEventListener('focus',function(){renderPasswordPolicy(createInput,document.getElementById('acPasswordPolicy'));});
    if(changeInput)changeInput.addEventListener('focus',function(){renderPasswordPolicy(changeInput,document.getElementById('flPasswordChangePolicy'));});
  }

  document.addEventListener('click',function(event){
    const refresh=event.target.closest&&event.target.closest('#flRefreshActivationCode');
    if(refresh){event.preventDefault();loadCode(true);return;}
    if(event.target.closest&&event.target.closest('#usersBtn,#umUsers,#alUsers,[data-fl-users]'))setTimeout(function(){loadCode(true);},0);
    if(event.target.closest&&event.target.closest('#newAcctBtn'))setTimeout(function(){
      const input=document.getElementById('acPass');if(input)renderPasswordPolicy(input,document.getElementById('acPasswordPolicy'));
    },0);
    if(event.target.closest&&event.target.closest('[data-change-password]'))setTimeout(function(){
      const label=document.getElementById('flPasswordNewLabel');if(label)label.textContent=text('New secure password','نوی خوندي پاسورډ');
      const input=document.getElementById('flPasswordNew');if(input)renderPasswordPolicy(input,document.getElementById('flPasswordChangePolicy'));
    },0);
  },true);

  const view=document.getElementById('usersView');
  if(view&&typeof MutationObserver==='function')new MutationObserver(function(){
    const open=usersOpen();
    if(open&&!wasOpen)loadCode(true);
    wasOpen=open;
  }).observe(view,{attributes:true,attributeFilter:['class']});


  /* ===== Combined hotfix r2: reliable tablet queue uploads + ascending ledger index ===== */
  function normalizePageNumberForSort(value){
    const digitMap={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
    return String(value==null?'':value).trim().replace(/[٠-٩۰-۹]/g,function(ch){return digitMap[ch]||ch;});
  }
  const flPageNumberCollatorR2=typeof Intl!=='undefined'&&Intl.Collator?new Intl.Collator('en',{numeric:true,sensitivity:'base'}):null;
  function compareLedgerPageNumbersR2(a,b){
    const left=normalizePageNumberForSort(a&&a.number),right=normalizePageNumberForSort(b&&b.number);
    const compared=flPageNumberCollatorR2?flPageNumberCollatorR2.compare(left,right):left.localeCompare(right);
    if(compared)return compared;
    const titleCompared=String(a&&a.title||'').localeCompare(String(b&&b.title||''),undefined,{sensitivity:'base'});
    return titleCompared||String(a&&a.id||'').localeCompare(String(b&&b.id||''));
  }
  function installAscendingBookIndexR2(){
    if(typeof bookIndexHTML!=='function'||bookIndexHTML.__ascendingPageIndexR2)return;
    const originalBookIndexHTML=bookIndexHTML;
    const sortedBookIndexHTML=function(){
      if(!currentBook||!Array.isArray(currentBook.pages)||currentBook.pages.length<2)return originalBookIndexHTML();
      const originalPages=currentBook.pages;
      currentBook.pages=originalPages.slice().sort(compareLedgerPageNumbersR2);
      try{return originalBookIndexHTML();}finally{currentBook.pages=originalPages;}
    };
    sortedBookIndexHTML.__ascendingPageIndexR2=true;
    bookIndexHTML=sortedBookIndexHTML;
  }

  function installForegroundTabletSyncR2(){
    if(typeof syncNow!=='function'||syncNow.__foregroundTabletQueueR2)return;
    const queuedSyncNow=syncNow;
    const reliableSyncNow=async function(options){
      const next=Object.assign({},options||{});
      /* An explicit or visible sync stays in the page. Android is much less likely
         to suspend the foreground page than a service worker during a large upload. */
      if(document.visibilityState!=='hidden'||next.forceRetry||next.forcePull)next.__foregroundV363=true;
      return queuedSyncNow(next);
    };
    reliableSyncNow.__foregroundTabletQueueR2=true;
    syncNow=reliableSyncNow;

    if(typeof flScheduleQueueRetryV382==='function'&&!flScheduleQueueRetryV382.__fasterQueueRetryR2){
      const fasterRetry=function(delay){
        clearTimeout(flSyncQueueRetryV382);
        if(!flGoogleDataSyncEnabledV365)return;
        const requested=Math.max(1800,Math.min(Number(delay)||2500,5000));
        flSyncQueueRetryV382=setTimeout(function(){syncNow({forceRetry:true,silent:true,__foregroundV363:true}).catch(function(){});},requested);
      };
      fasterRetry.__fasterQueueRetryR2=true;
      flScheduleQueueRetryV382=fasterRetry;
    }
  }

  installAscendingBookIndexR2();
  installForegroundTabletSyncR2();

  installPasswordGuidance();
  addEventListener('load',function(){
    wasOpen=usersOpen();if(wasOpen)loadCode(true);
    installPasswordGuidance();
  });
}());
