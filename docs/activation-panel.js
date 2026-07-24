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


  /* ===== Tablet synchronization reliability r3 ===== */
  const FL_TABLET_SYNC_PATCH_R3='2026-07-24-tablet-sync-r4';
  const FL_TABLET_CHUNK_SIZE_R3=700000;
  const FL_DEVICE_SYNC_ACTIONS_R3=new Set([
    'syncQueueJoin','syncQueueStatus','syncQueueRelease','syncHead','pullManifest','pullChunk','imageIndex',
    'pushStart','pushChunk','pushCommit','uploadStatus','restoreStart','restoreChunk','restoreCommit',
    'importStart','importChunk','importCommit'
  ]);
  async function flDeviceIdR3(task){
    if(task&&task.deviceId)return String(task.deviceId);
    const meta=typeof getMeta==='function'?await getMeta():{};
    return String(meta&&meta.deviceId||'');
  }

  /* Every queued request must use the same device identity that joined the queue.
     Older code omitted it from chunk/status/commit calls and could lose its turn. */
  if(typeof api==='function'&&!api.__tabletDeviceIdentityR3){
    const flApiBeforeTabletR3=api;
    const flApiTabletR3=async function(action,payload,options){
      const name=String(action||'');
      let next=payload&&typeof payload==='object'?payload:{};
      if(FL_DEVICE_SYNC_ACTIONS_R3.has(name)&&!next.deviceId){
        const deviceId=await flDeviceIdR3();
        if(deviceId)next=Object.assign({},next,{deviceId:deviceId});
      }
      return flApiBeforeTabletR3(name,next,options||{});
    };
    flApiTabletR3.__tabletDeviceIdentityR3=true;
    api=flApiTabletR3;
  }

  /* Cache the server image index after a successful refresh. This keeps later
     uploads sparse instead of repeatedly rebuilding a large image package. */
  if(typeof flGetImageIndexV364==='function'&&!flGetImageIndexV364.__cacheIndexR3){
    const flGetImageIndexBeforeR3=flGetImageIndexV364;
    const flGetImageIndexR3=async function(force){
      const index=await flGetImageIndexBeforeR3(!!force);
      if(index&&typeof kvSet==='function'&&typeof K!=='undefined'&&K.IMAGE_INDEX)await kvSet(K.IMAGE_INDEX,index);
      return index;
    };
    flGetImageIndexR3.__cacheIndexR3=true;
    flGetImageIndexV364=flGetImageIndexR3;
  }

  let flQueueHeartbeatR3=null,flQueueHeartbeatBusyR3=false;
  function flStopQueueHeartbeatR3(){if(flQueueHeartbeatR3){clearInterval(flQueueHeartbeatR3);flQueueHeartbeatR3=null;}flQueueHeartbeatBusyR3=false;}
  function flStartQueueHeartbeatR3(){
    flStopQueueHeartbeatR3();
    flQueueHeartbeatR3=setInterval(async function(){
      if(flQueueHeartbeatBusyR3||!flGoogleDataSyncEnabledV365||!backendToken||!navigator.onLine)return;
      flQueueHeartbeatBusyR3=true;
      try{
        const deviceId=await flDeviceIdR3(),status=await api('syncQueueJoin',{deviceId:deviceId},{timeout:25000});
        flSyncQueueStatusV382=status||flSyncQueueStatusV382;
        flSyncTurnHeldV382=!!(status&&status.granted);
        if(typeof flUpdateSyncQueueUiV382==='function')flUpdateSyncQueueUiV382();
      }catch(error){console.warn('sync turn heartbeat',error);}
      finally{flQueueHeartbeatBusyR3=false;}
    },90000);
  }
  if(typeof flAcquireSyncTurnV382==='function'&&!flAcquireSyncTurnV382.__heartbeatR3){
    const flAcquireTurnBeforeR3=flAcquireSyncTurnV382;
    const flAcquireTurnR3=async function(){const status=await flAcquireTurnBeforeR3();flStartQueueHeartbeatR3();return status;};
    flAcquireTurnR3.__heartbeatR3=true;flAcquireSyncTurnV382=flAcquireTurnR3;
  }
  if(typeof flReleaseSyncTurnV382==='function'&&!flReleaseSyncTurnV382.__heartbeatR3){
    const flReleaseTurnBeforeR3=flReleaseSyncTurnV382;
    const flReleaseTurnR3=async function(){flStopQueueHeartbeatR3();return flReleaseTurnBeforeR3();};
    flReleaseTurnR3.__heartbeatR3=true;flReleaseSyncTurnV382=flReleaseTurnR3;
  }

  async function flPrepareUploadTaskR3(task){
    if(!task)return task;
    const currentSize=Math.max(1,Number(task.chunkSize)||FL_TABLET_CHUNK_SIZE_R3);
    const needsMigration=task.transportPatch!==FL_TABLET_SYNC_PATCH_R3||currentSize>FL_TABLET_CHUNK_SIZE_R3;
    if(needsMigration){
      /* Pending operations remain in IndexedDB. Only the temporary network
         package is restarted with smaller chunks and a new idempotency key. */
      if(typeof restartUploadForCurrentUser==='function')await restartUploadForCurrentUser(task);
      else{task.uploadId='';task.nextChunk=0;task.changeId=uid(task.kind==='restore'?'RESTORE':task.kind==='import'?'IMPORT':'CHANGE');task.attempts=0;task.nextRetryAt=0;task.lastError='';}
      task.version=Math.max(7,Number(task.version)||0);
      task.transportPatch=FL_TABLET_SYNC_PATCH_R3;
      task.chunkSize=FL_TABLET_CHUNK_SIZE_R3;
      task.chunkCount=Math.max(1,Math.ceil(String(task.text||'').length/task.chunkSize));
      await saveTask(task);
    }
    return task;
  }

  async function flResumeUploadSerialR3(task,options){
    options=options||{};
    if(!task)return null;
    if(task.kind==='state'){
      try{JSON.parse(String(task.text||''));}
      catch(_){await kvDel(K.UPLOAD_TASK);task=await buildUploadTask('state',{force:true});if(!task)throw Object.assign(new Error('The local synchronization package could not be rebuilt.'),{code:'LOCAL_STATE_INVALID'});}
    }
    task=await flPrepareUploadTaskR3(task);
    const owner=uploadTaskOwner();
    if(task.kind==='state'&&task.ownerUserId&&owner&&String(task.ownerUserId)!==String(owner)){await restartUploadForCurrentUser(task);task=await flPrepareUploadTaskR3(task);}
    if(!options.forceRetry&&Number(task.nextRetryAt)>Date.now())throw Object.assign(new Error('Synchronization is waiting before the next retry.'),{code:'RETRY_WAIT'});
    const actions=uploadActions(task.kind),parts=chunkText(String(task.text||''),Number(task.chunkSize)||FL_TABLET_CHUNK_SIZE_R3),meta=await getMeta(),deviceId=String(task.deviceId||meta.deviceId||'');
    try{
      let startedNow=false;
      if(!task.uploadId){
        setStatus('syncing',text('Preparing Google upload…','Google اپلوډ چمتو کېږي…'));
        const started=await api(actions.start,{kind:task.kind,deviceId:deviceId,baseRevision:task.baseRevision,chunkCount:parts.length,hash:task.hash,size:task.size,changeId:task.changeId},{timeout:45000});
        if(started.alreadyCommitted)return{revision:Number(started.revision)||0,hash:String(started.hash||''),alreadyCommitted:true,requiresPull:!!started.requiresPull};
        task.ownerUserId=owner;task.uploadId=started.uploadId;task.nextChunk=0;startedNow=!started.resumed;await saveTask(task);
      }
      let received=new Set();
      if(!startedNow){
        try{
          const status=await api('uploadStatus',{uploadId:task.uploadId,deviceId:deviceId},{timeout:45000});
          if(status.committed)return{revision:Number(status.revision)||0,hash:String(status.hash||''),alreadyCommitted:true,requiresPull:!!status.requiresPull};
          received=new Set((status.receivedIndexes||[]).map(Number));
        }catch(error){
          if((error.code==='UPLOAD_NOT_FOUND'||error.code==='FORBIDDEN')&&!options.restarted){await restartUploadForCurrentUser(task);return flResumeUploadSerialR3(task,Object.assign({},options,{forceRetry:true,restarted:true}));}
          throw error;
        }
      }
      const missing=parts.map(function(_,index){return index;}).filter(function(index){return !received.has(index);});
      /* Apps Script and Drive are deliberately used one request at a time.
         Parallel chunk calls were racing over the queue lease and temp folder. */
      for(let offset=0;offset<missing.length;offset++){
        const index=missing[offset];
        setStatus('syncing',text('Uploading part '+(received.size+1)+' of '+parts.length,'برخه '+(received.size+1)+' له '+parts.length+' څخه اپلوډ کېږي'));
        await api(actions.chunk,{uploadId:task.uploadId,index:index,data:parts[index],deviceId:deviceId},{timeout:120000});
        received.add(index);task.nextChunk=received.size;await saveTask(task);
        if(typeof flTouchSyncLease==='function')await flTouchSyncLease(flSyncLeaseOwner);
        await new Promise(function(resolve){setTimeout(resolve,0);});
      }
      setStatus('syncing',text('Google received every part · finalizing…','Google ټولې برخې ترلاسه کړې · بشپړېږي…'));
      return await api(actions.commit,{uploadId:task.uploadId,deviceId:deviceId},{timeout:330000});
    }catch(error){
      const recoverable=['UPLOAD_INCOMPLETE','CHECKSUM_FAILED','INVALID_JSON','UPLOAD_NOT_FOUND','STATE_WRITE_INCOMPLETE'].includes(String(error&&error.code||''));
      if(recoverable&&!options.restarted){await restartUploadForCurrentUser(task);return flResumeUploadSerialR3(task,Object.assign({},options,{forceRetry:true,restarted:true}));}
      task.attempts=(Number(task.attempts)||0)+1;task.nextRetryAt=Date.now()+Math.min(15*60*1000,5000*Math.pow(2,Math.min(task.attempts-1,7)));task.lastError=error&&error.message||String(error);await saveTask(task);throw error;
    }
  }

  if(typeof resumeUploadTask==='function'&&!resumeUploadTask.__serialTabletR3){
    const flResumeUploadR3=async function(task,options){
      options=options||{};
      try{return await flResumeUploadSerialR3(task,options);}
      catch(error){
        if(error&&error.code==='IMAGE_REF_MISSING'&&task&&!options.indexRefreshed){
          await flGetImageIndexV364(true);await kvDel(K.UPLOAD_TASK);
          const rebuilt=await buildUploadTask('state',{force:true});
          if(rebuilt)return flResumeUploadR3(rebuilt,Object.assign({},options,{forceRetry:true,indexRefreshed:true}));
        }
        throw error;
      }
    };
    flResumeUploadR3.__serialTabletR3=true;resumeUploadTask=flResumeUploadR3;
  }

  /* Do not silently accept the old backend: its 3.8.2 version string is the
     same even when the queue reliability patch was never deployed. */
  if(typeof flCheckBackendCompatibilityV381==='function'&&!flCheckBackendCompatibilityV381.__requiresR3){
    const flCheckBackendBeforeR3=flCheckBackendCompatibilityV381;
    const flCheckBackendR3=async function(){
      const status=await flCheckBackendBeforeR3();
      if(String(status&&status.syncQueuePatch||'')!==FL_TABLET_SYNC_PATCH_R3)throw Object.assign(new Error(text('The tablet synchronization backend patch is not deployed. Update the existing Apps Script deployment with the r3 Code.gs, then try again.','د ټابلیټ د سینک backend اصلاح لا نه ده خپره شوې. د Apps Script موجود deployment د r3 Code.gs سره تازه کړئ او بیا هڅه وکړئ.')),{code:'BACKEND_SYNC_PATCH_REQUIRED',status:status});
      return status;
    };
    flCheckBackendR3.__requiresR3=true;flCheckBackendCompatibilityV381=flCheckBackendR3;
  }

  async function flRepairPendingUploadR3(){
    await localChain;
    const task=await kvGet(K.UPLOAD_TASK);
    if(task)await kvDel(K.UPLOAD_TASK);
    await setMeta({lastError:''});
    setStatus('pending',text('Rebuilding the pending upload safely…','پاتې اپلوډ په خوندي ډول بیا جوړېږي…'));
    return syncNow({forceRetry:true,silent:false,__foregroundV363:true});
  }
  function flInstallRepairButtonR3(){
    const root=flOfflineDataModalV365&&flOfflineDataModalV365.querySelector('[data-fl-offline-body]');if(!root)return;
    const actions=root.querySelector('[data-fl-unified-device] .fl-unified-actions')||root.querySelector('.fl-unified-actions');if(!actions||actions.querySelector('[data-fl-repair-upload-r3]'))return;
    const button=document.createElement('button');button.type='button';button.className='btn btn-ghost';button.dataset.flRepairUploadR3='1';button.textContent=text('Repair pending upload & retry','پاتې اپلوډ ورغوئ او بیا هڅه وکړئ');
    button.onclick=async function(){button.disabled=true;try{await flRepairPendingUploadR3();await flRenderUnifiedStorageV383();}catch(error){toast(error&&error.message||String(error));}finally{button.disabled=false;}};
    actions.appendChild(button);
  }
  if(typeof flRenderUnifiedStorageV383==='function'&&!flRenderUnifiedStorageV383.__repairButtonR3){
    const flRenderUnifiedBeforeR3=flRenderUnifiedStorageV383;
    const flRenderUnifiedR3=async function(){const result=await flRenderUnifiedBeforeR3();flInstallRepairButtonR3();return result;};
    flRenderUnifiedR3.__repairButtonR3=true;flRenderUnifiedStorageV383=flRenderUnifiedR3;flRenderOfflineDataV365=flRenderUnifiedStorageV383;
  }


  /* ===== r4: truthful transfer progress, English-safe errors and retry diagnostics ===== */
  const FL_CONNECTION_PATCH_R5='tablet-sync-r5';
  const FL_SYNC_PROGRESS_PATCH_R4='2026-07-24-tablet-sync-r4';
  let flProgressR4={stage:'idle',percent:0,uploadedBytes:0,totalBytes:0,confirmedParts:0,totalParts:0,message:'',error:'',errorCode:'',retryAt:0,updatedAt:Date.now()};
  let flConfirmedPartsR4=new Set(),flProgressTimerR4=null;
  function flLangR4(){return typeof LANG!=='undefined'&&LANG==='ps'?'ps':'en';}
  function flTrR4(en,ps){return flLangR4()==='ps'?ps:en;}
  function flBytesR4(value){const n=Math.max(0,Number(value)||0);if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(n<10240?1:0)+' KB';if(n<1073741824)return(n/1048576).toFixed(n<10485760?1:0)+' MB';return(n/1073741824).toFixed(1)+' GB';}
  function flStripMarkupR4(value){return String(value==null?'':value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
  function flJsonMessageR4(value,depth){
    let text=flStripMarkupR4(value);depth=Number(depth)||0;if(!text||depth>3)return text;
    if((text[0]==='{'&&text[text.length-1]==='}')||(text[0]==='['&&text[text.length-1]===']'))try{const parsed=JSON.parse(text);if(parsed&&parsed.error)return flJsonMessageR4(parsed.error.message||parsed.error,depth+1);if(parsed&&parsed.message)return flJsonMessageR4(parsed.message,depth+1);return'';}catch(_){}
    return text.replace(/^Exception:\s*/i,'').replace(/^Error:\s*/i,'').trim();
  }
  function flErrorCodeR4(error){return String(error&&error.code||error&&error.details&&error.details.code||'SYNC_ERROR').trim()||'SYNC_ERROR';}
  function flMappedErrorR4(code){
    const en={
      NETWORK_BLOCKED:'The tablet could not reach Google. Check Wi-Fi, Chrome data access and any network filtering.',API_TIMEOUT:'Google did not answer before the request timeout. The last confirmed upload part remains saved and will resume.',GOOGLE_TRANSPORT_UNAVAILABLE:'The tablet could not establish a Google transport. Local changes remain safe.',DEPLOYMENT_NOT_PUBLIC_OR_UNREACHABLE:'The Apps Script web app is not publicly reachable from this tablet. Verify Execute as me, Who has access: Anyone, and the deployment URL.',ORIGIN_BLOCKED:'The Apps Script backend rejected the GitHub Pages origin. Install backend patch r5 or run repairZiqarTradingConnection() once.',BRIDGE_TIMEOUT:'The Apps Script bridge did not finish starting within 60 seconds.',BRIDGE_LOAD_FAILED:'Chrome could not load the Apps Script bridge page.',INVALID_BACKEND_RESPONSE:'Google returned an unreadable response. No local data was deleted.',UPLOAD_INCOMPLETE:'Google is missing one or more upload parts. The transfer will resume from the last confirmed part.',CHECKSUM_FAILED:'Google received data that did not pass integrity checking. The temporary upload will be rebuilt safely.',INVALID_JSON:'The temporary synchronisation package was incomplete. It will be rebuilt from the unchanged local database.',STATE_WRITE_INCOMPLETE:'Google Drive did not finish saving the server copy. The previous server copy remains protected.',UPLOAD_NOT_FOUND:'The previous temporary upload expired or was removed. A new temporary upload will be created.',IMAGE_REF_MISSING:'Google is missing an image reference. The image index will be refreshed and the upload rebuilt.',IMAGE_INDEX_UNAVAILABLE:'The Google image index is not ready. Local images remain safe and the app will retry.',SYNC_QUEUED:'This tablet is waiting for its protected transfer turn.',SYNC_DISABLED_BY_ADMIN:'The administrator has disabled business-data transfer for this account.',DATASET_RESET_REQUIRED:'This tablet belongs to an older protected dataset. Export its local data before adopting the Google master.',BACKEND_SYNC_PATCH_REQUIRED:'The current Apps Script deployment does not contain the required tablet sync patch.',SERVER_BUSY:'Google is finishing another synchronisation operation. Your local changes remain pending.',RETRY_WAIT:'Automatic retry is waiting for the scheduled time.',SESSION_EXPIRED:'The session expired. Sign in again; local data remains safe.',SESSION_INVALID:'This session was signed out. Sign in again; local data remains safe.',LOCAL_STATE_INVALID:'The temporary package could not be rebuilt from local storage. Download the local backup before further recovery.'
    };
    const ps={
      NETWORK_BLOCKED:'ټابلیټ Google ته ونه رسېد. Wi‑Fi او د Chrome شبکې اجازه وګورئ.',API_TIMEOUT:'Google پر وخت ځواب ورنه کړ. وروستۍ تایید شوې برخه خوندي ده او لېږد به دوام وکړي.',UPLOAD_INCOMPLETE:'Google ته ځینې برخې نه دي رسېدلي. لېږد به له وروستۍ تایید شوې برخې دوام وکړي.',SYNC_QUEUED:'دا ټابلیټ د خوندي لېږد نوبت ته انتظار کوي.',SYNC_DISABLED_BY_ADMIN:'اډمین د دې حساب د معلوماتو لېږد بند کړی.',SERVER_BUSY:'Google بل لېږد بشپړوي. محلي بدلونونه خوندي او پاتې دي.',RETRY_WAIT:'اتومات بیا هڅه ټاکلي وخت ته انتظار کوي.'
    };
    return(flLangR4()==='ps'?ps:en)[code]||'';
  }
  function flNormaliseErrorR4(error){
    const code=flErrorCodeR4(error),mapped=flMappedErrorR4(code),raw=flJsonMessageR4(error&&error.message||error),hasPashto=/[\u0600-\u06ff]/.test(raw),looksRaw=/^[\[{]|"ok"\s*:|"error"\s*:|<!doctype|<html/i.test(String(error&&error.message||''));
    let message=mapped||raw||flTrR4('Synchronisation failed. Local data remains safe.','سینک ناکام شو. محلي معلومات خوندي دي.');
    if(flLangR4()==='en'&&(hasPashto||looksRaw))message=mapped||'Synchronisation failed. Local data remains safe; use the technical code below when reporting it.';
    const clean=Object.assign(new Error(message),{code:code,details:error&&error.details||null,original:error});
    return{error:clean,code:code,message:message,raw:raw};
  }
  function flProgressLabelR4(stage){
    const labels={idle:['Ready','چمتو'],queued:['Waiting for transfer turn','د لېږد نوبت ته انتظار'],preparing:['Preparing the local upload package','محلي اپلوډ چمتو کېږي'],uploading:['Uploading confirmed parts to Google','Google ته تایید شوې برخې اپلوډ کېږي'],finalizing:['100% uploaded · Google is validating and saving','۱۰۰٪ اپلوډ شو · Google یې تایید او خوندي کوي'],verifying:['Upload accepted · checking the server copy','اپلوډ ومنل شو · د سرور کاپي کتل کېږي'],complete:['Synchronisation completed','سینک بشپړ شو'],pending:['Changes remain pending','بدلونونه لا پاتې دي'],scheduled:['Retry scheduled','بیا هڅه ټاکل شوې'],error:['Synchronisation paused','سینک ودرېد']};
    const pair=labels[stage]||labels.idle;return flLangR4()==='ps'?pair[1]:pair[0];
  }
  function flSetProgressR4(update){flProgressR4=Object.assign({},flProgressR4,update||{},{updatedAt:Date.now()});flProgressR4.percent=Math.max(0,Math.min(100,Math.floor(Number(flProgressR4.percent)||0)));flRenderProgressR4();}
  function flRetryTextR4(){const at=Number(flProgressR4.retryAt)||0;if(!at)return'';const remain=Math.max(0,Math.ceil((at-Date.now())/1000));if(!remain)return flTrR4('Retry is due now.','بیا هڅه اوس ده.');return flTrR4('Automatic retry in '+remain+' seconds.','اتومات بیا هڅه په '+remain+' ثانیو کې.');}
  function flRenderProgressR4(){
    const body=flOfflineDataModalV365&&flOfflineDataModalV365.querySelector('[data-fl-offline-body]');if(!body)return;
    let panel=body.querySelector('[data-fl-sync-progress-r4]');if(!panel){panel=document.createElement('section');panel.className='fl-unified-section fl-sync-progress-r4';panel.dataset.flSyncProgressR4='1';const device=body.querySelector('[data-fl-unified-device]');device?device.after(panel):body.prepend(panel);}
    const p=flProgressR4,hasTotal=Number(p.totalBytes)>0,measure=hasTotal?flBytesR4(p.uploadedBytes)+' / '+flBytesR4(p.totalBytes):'',parts=p.totalParts?flTrR4('Google confirmed '+Number(p.confirmedParts||0)+' of '+Number(p.totalParts)+' parts.','Google له '+Number(p.totalParts)+' څخه '+Number(p.confirmedParts||0)+' برخې تایید کړې.'):'',retry=flRetryTextR4();
    panel.innerHTML='<h3>'+flTrR4('Live Google transfer progress','د Google ژوندی لېږد')+'</h3><p>'+flTrR4('The percentage increases only after Google confirms a complete upload part. 100% means every byte reached Google; final validation may still be running.','سلنه یوازې هغه وخت لوړېږي چې Google بشپړه برخه تایید کړي. ۱۰۰٪ یعنې ټول بایټونه رسېدلي؛ وروستی تایید لا روان کېدای شي.')+'</p><div class="fl-progress-head"><b>'+flProgressLabelR4(p.stage)+'</b><strong>'+p.percent+'%</strong></div><div class="fl-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+p.percent+'"><span style="width:'+p.percent+'%"></span></div><div class="fl-progress-meta"><span>'+measure+'</span><span>'+parts+'</span></div>'+(retry?'<div class="fl-progress-retry">'+retry+'</div>':'')+(p.error?'<div class="fl-progress-error"><b>'+flTrR4('Current error','اوسنۍ تېروتنه')+':</b> '+String(p.error).replace(/[<>]/g,'')+'<small>'+flTrR4('Technical code','تخنیکي کوډ')+': '+String(p.errorCode||'SYNC_ERROR').replace(/[^A-Z0-9_-]/gi,'')+'</small></div>':'')+'<div class="fl-connection-doctor-r5"><button class="btn btn-ghost" type="button" data-fl-connection-doctor-r5>'+flTrR4('Run Google connection test','د Google اړیکه وازمویئ')+'</button><span data-fl-connection-result-r5></span></div>';
    const doctorButton=panel.querySelector('[data-fl-connection-doctor-r5]');if(doctorButton)doctorButton.onclick=function(){flRunConnectionDoctorR5().catch(function(){});};
  }
  async function flRunConnectionDoctorR5(){
    const panel=document.querySelector('[data-fl-sync-progress-r4]'),result=panel&&panel.querySelector('[data-fl-connection-result-r5]'),button=panel&&panel.querySelector('[data-fl-connection-doctor-r5]');
    if(button)button.disabled=true;if(result)result.textContent=flTrR4('Opening secure Google bridge…','خوندي Google اړیکه پرانیستل کېږي…');
    try{clearBridge();const started=Date.now();const status=await flBridgeApiV381('ping',{}, {noToken:true,timeout:60000});if(!status||status.backendVersion!=='3.8.2')throw Object.assign(new Error('Unexpected backend response'),{code:'BACKEND_VERSION_MISMATCH'});if(result)result.textContent=flTrR4('Connected in ','وصل شو په ')+Math.max(1,Math.round((Date.now()-started)/1000))+'s · backend '+status.backendVersion+' · '+String(status.syncQueuePatch||'no patch');flSetProgressR4({error:'',errorCode:'',retryAt:0});return status;}catch(raw){const normal=flNormaliseErrorR4(raw);if(result)result.textContent=normal.message+' · '+normal.code;flSetProgressR4({stage:'error',error:normal.message,errorCode:normal.code});throw normal.error;}finally{if(button)button.disabled=false;}}
  function flInstallProgressStylesR4(){if(document.getElementById('flSyncProgressStylesR4'))return;const style=document.createElement('style');style.id='flSyncProgressStylesR4';style.textContent='.fl-sync-progress-r4{display:block!important}.fl-progress-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 8px}.fl-progress-head strong{font-family:"Spline Sans Mono",monospace;font-size:18px}.fl-progress-track{height:14px;border-radius:999px;background:var(--surface-2);border:1px solid var(--border);overflow:hidden}.fl-progress-track span{display:block;height:100%;background:var(--accent);transition:width .25s ease}.fl-progress-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--soft);font-size:12px;margin-top:8px}.fl-progress-retry{margin-top:10px;padding:8px 10px;border-radius:9px;background:var(--accent-soft);font-size:12px}.fl-progress-error{margin-top:10px;padding:10px 11px;border-radius:10px;border:1px solid #d08b84;background:color-mix(in srgb,#d94c3d 9%,var(--surface));font-size:12px;line-height:1.45}.fl-progress-error small{display:block;margin-top:5px;color:var(--soft)}.fl-connection-doctor-r5{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}.fl-connection-doctor-r5 span{font-size:12px;color:var(--soft)}';document.head.appendChild(style);}
  async function flTaskMeasureR4(){const task=typeof kvGet==='function'&&typeof K!=='undefined'?await kvGet(K.UPLOAD_TASK):null;if(!task)return null;const total=Number(task.size)||String(task.text||'').length,chunkSize=Math.max(1,Number(task.chunkSize)||700000),confirmed=Math.max(0,Number(task.nextChunk)||0),bytes=Math.min(total,confirmed*chunkSize);return{task:task,total:total,bytes:bytes,confirmed:confirmed,totalParts:Number(task.chunkCount)||Math.ceil(total/chunkSize),retryAt:Number(task.nextRetryAt)||0};}
  async function flRestoreProgressR4(){try{const measure=await flTaskMeasureR4(),summary=typeof pendingSummary==='function'?await pendingSummary():null;if(measure){flSetProgressR4({stage:measure.retryAt>Date.now()?'scheduled':'pending',percent:Math.floor(measure.bytes*100/Math.max(1,measure.total)),uploadedBytes:measure.bytes,totalBytes:measure.total,confirmedParts:measure.confirmed,totalParts:measure.totalParts,retryAt:measure.retryAt,error:measure.task.lastError?flNormaliseErrorR4(Object.assign(new Error(measure.task.lastError),{code:measure.task.lastErrorCode||'SYNC_ERROR'})).message:'',errorCode:measure.task.lastErrorCode||''});}else if(summary&&(summary.count||summary.task))flSetProgressR4({stage:'pending',percent:0,uploadedBytes:0,totalBytes:0,confirmedParts:0,totalParts:0,retryAt:0});else flSetProgressR4({stage:'idle',percent:0,uploadedBytes:0,totalBytes:0,confirmedParts:0,totalParts:0,retryAt:0,error:'',errorCode:''});}catch(error){console.warn('restore sync progress',error);}}
  function flConfirmedBytesR4(task){if(!task)return{bytes:0,total:0,totalParts:0};const text=String(task.text||''),size=Math.max(1,Number(task.chunkSize)||700000),total=Number(task.size)||text.length,totalParts=Number(task.chunkCount)||Math.ceil(total/size);let bytes=0;flConfirmedPartsR4.forEach(function(index){const start=Number(index)*size;if(start<total)bytes+=Math.min(size,total-start);});return{bytes:Math.min(total,bytes),total:total,totalParts:totalParts};}

  if(typeof api==='function'&&!api.__truthfulProgressR4){
    const flApiBeforeR4=api;
    const flApiR4=async function(action,payload,options){
      const name=String(action||''),data=payload&&typeof payload==='object'?payload:{};
      try{
        if(name==='syncQueueJoin')flSetProgressR4({stage:'queued',percent:0,message:'',error:'',errorCode:'',retryAt:0});
        if(name==='pushStart')flSetProgressR4({stage:'preparing',percent:0,uploadedBytes:0,totalBytes:Number(data.size)||0,confirmedParts:0,totalParts:Number(data.chunkCount)||0,error:'',errorCode:'',retryAt:0});
        if(name==='pushChunk'){const task=await kvGet(K.UPLOAD_TASK);const measured=flConfirmedBytesR4(task);flSetProgressR4({stage:'uploading',percent:Math.floor(measured.bytes*100/Math.max(1,measured.total)),uploadedBytes:measured.bytes,totalBytes:measured.total,confirmedParts:flConfirmedPartsR4.size,totalParts:measured.totalParts,error:'',errorCode:'',retryAt:0});}
        if(name==='pushCommit'){const task=await kvGet(K.UPLOAD_TASK),total=task?(Number(task.size)||String(task.text||'').length):Number(flProgressR4.totalBytes)||0;flSetProgressR4({stage:'finalizing',percent:100,uploadedBytes:total,totalBytes:total,confirmedParts:Number(task&&task.chunkCount)||flProgressR4.totalParts,totalParts:Number(task&&task.chunkCount)||flProgressR4.totalParts,error:'',errorCode:'',retryAt:0});}
        const result=await flApiBeforeR4(name,data,options||{});
        if(name==='syncQueueJoin'){if(result&&result.granted)flSetProgressR4({stage:'preparing',percent:0});else flSetProgressR4({stage:'queued',percent:0,message:flTrR4('Queue position '+(Number(result&&result.position)||1),'د کتار نوبت '+(Number(result&&result.position)||1))});}
        if(name==='uploadStatus'&&result){flConfirmedPartsR4=new Set((result.receivedIndexes||[]).map(Number));const task=await kvGet(K.UPLOAD_TASK),measured=flConfirmedBytesR4(task);flSetProgressR4({stage:result.committed?'verifying':'uploading',percent:result.committed?100:Math.floor(measured.bytes*100/Math.max(1,measured.total)),uploadedBytes:result.committed?measured.total:measured.bytes,totalBytes:measured.total,confirmedParts:flConfirmedPartsR4.size,totalParts:measured.totalParts,error:'',errorCode:'',retryAt:0});}
        if(name==='pushChunk'){flConfirmedPartsR4.add(Number(data.index));const task=await kvGet(K.UPLOAD_TASK),measured=flConfirmedBytesR4(task);flSetProgressR4({stage:'uploading',percent:Math.floor(measured.bytes*100/Math.max(1,measured.total)),uploadedBytes:measured.bytes,totalBytes:measured.total,confirmedParts:flConfirmedPartsR4.size,totalParts:measured.totalParts,error:'',errorCode:'',retryAt:0});}
        if(name==='pushCommit')flSetProgressR4({stage:'verifying',percent:100,error:'',errorCode:'',retryAt:0});
        return result;
      }catch(raw){const normal=flNormaliseErrorR4(raw);if(normal.code==='SYNC_QUEUED')flSetProgressR4({stage:'queued',percent:0,error:'',errorCode:'',retryAt:0});else{let retryAt=0;try{const task=await kvGet(K.UPLOAD_TASK);retryAt=Number(task&&task.nextRetryAt)||0;}catch(_){}flSetProgressR4({stage:retryAt>Date.now()?'scheduled':'error',error:normal.message,errorCode:normal.code,retryAt:retryAt});}throw normal.error;}
    };
    flApiR4.__truthfulProgressR4=true;api=flApiR4;
  }

  if(typeof setStatus==='function'&&!setStatus.__englishSafeR4){const flSetStatusBeforeR4=setStatus;const flSetStatusR4=function(kind,message){let safe=flJsonMessageR4(message);if(flLangR4()==='en'&&(/[\u0600-\u06ff]/.test(safe)||/^[\[{]|"error"\s*:|<!doctype|<html/i.test(String(message||''))))safe=kind==='syncing'?'Synchronising…':kind==='pending'?'Changes pending · open Storage & Sync for progress':kind==='failed'?'Synchronisation paused · open Storage & Sync for the error':'Saved locally';return flSetStatusBeforeR4(kind,safe||kind);};flSetStatusR4.__englishSafeR4=true;setStatus=flSetStatusR4;}

  if(typeof syncNow==='function'&&!syncNow.__progressLifecycleR4){const flSyncBeforeR4=syncNow;const flSyncR4=async function(options){const opts=Object.assign({},options||{});if(!opts.silent)flSetProgressR4({stage:'queued',percent:0,error:'',errorCode:'',retryAt:0});try{const result=await flSyncBeforeR4(opts);if(result&&result.queued){flSetProgressR4({stage:'queued',percent:0});return result;}const q=typeof pendingSummary==='function'?await pendingSummary():null;if(q&&(q.count||q.task)){const m=await flTaskMeasureR4();flSetProgressR4({stage:m&&m.retryAt>Date.now()?'scheduled':'pending',percent:m?Math.floor(m.bytes*100/Math.max(1,m.total)):flProgressR4.percent,uploadedBytes:m?m.bytes:flProgressR4.uploadedBytes,totalBytes:m?m.total:flProgressR4.totalBytes,confirmedParts:m?m.confirmed:flProgressR4.confirmedParts,totalParts:m?m.totalParts:flProgressR4.totalParts,retryAt:m?m.retryAt:0});}else flSetProgressR4({stage:'complete',percent:100,uploadedBytes:flProgressR4.totalBytes,totalBytes:flProgressR4.totalBytes,confirmedParts:flProgressR4.totalParts,totalParts:flProgressR4.totalParts,error:'',errorCode:'',retryAt:0});return result;}catch(raw){const normal=flNormaliseErrorR4(raw);let retryAt=0;try{const task=await kvGet(K.UPLOAD_TASK);retryAt=Number(task&&task.nextRetryAt)||0;if(task){task.lastError=normal.message;task.lastErrorCode=normal.code;await saveTask(task);}}catch(_){}flSetProgressR4({stage:retryAt>Date.now()?'scheduled':'error',error:normal.message,errorCode:normal.code,retryAt:retryAt});throw normal.error;}};flSyncR4.__progressLifecycleR4=true;syncNow=flSyncR4;}

  function flInstallProgressPanelR4(){flInstallProgressStylesR4();flRenderProgressR4();const body=flOfflineDataModalV365&&flOfflineDataModalV365.querySelector('[data-fl-offline-body]');if(!body)return;const transfer=body.querySelector('[data-fl-unified-transfer]');if(transfer&&!transfer.dataset.flProgressR4){transfer.dataset.flProgressR4='1';transfer.onclick=async function(){transfer.disabled=true;try{await syncNow({forcePull:false,forceRetry:true,silent:false,__foregroundV363:true});await flRenderUnifiedStorageV383();}catch(error){const normal=flNormaliseErrorR4(error);toast(normal.message);}finally{transfer.disabled=false;flRenderProgressR4();}};}}
  if(typeof flRenderUnifiedStorageV383==='function'&&!flRenderUnifiedStorageV383.__progressR4){const flRenderUnifiedBeforeR4=flRenderUnifiedStorageV383;const flRenderUnifiedR4=async function(){const result=await flRenderUnifiedBeforeR4();flInstallProgressPanelR4();await flRestoreProgressR4();return result;};flRenderUnifiedR4.__progressR4=true;flRenderUnifiedStorageV383=flRenderUnifiedR4;flRenderOfflineDataV365=flRenderUnifiedStorageV383;}
  if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',function(event){const data=event.data||{},detail=data.detail||{};if(data.type==='FIELD_LEDGER_SYNC_PROGRESS')flSetProgressR4({stage:String(detail.stage||'uploading'),percent:Number(detail.percent)||0,uploadedBytes:Number(detail.uploadedBytes)||0,totalBytes:Number(detail.totalBytes)||0,confirmedParts:Number(detail.confirmedParts)||0,totalParts:Number(detail.totalParts)||0,error:'',errorCode:'',retryAt:0});if(data.type==='FIELD_LEDGER_BACKGROUND_SYNC_FAILED'){const normal=flNormaliseErrorR4(Object.assign(new Error(detail.message||'Background synchronization failed'),{code:detail.code||'SYNC_ERROR'}));flSetProgressR4({stage:'error',error:normal.message,errorCode:normal.code});}});
  if(typeof applyLang==='function'&&!applyLang.__progressLanguageR4){const flApplyLangBeforeR4=applyLang;const flApplyLangR4=function(){const result=flApplyLangBeforeR4.apply(this,arguments);flRenderProgressR4();return result;};flApplyLangR4.__progressLanguageR4=true;applyLang=flApplyLangR4;}
  flProgressTimerR4=setInterval(function(){const body=flOfflineDataModalV365&&flOfflineDataModalV365.querySelector('[data-fl-offline-body]');if(body&&flProgressR4.retryAt)flRenderProgressR4();},1000);
  flInstallProgressStylesR4();flRestoreProgressR4();

  installPasswordGuidance();
  addEventListener('load',function(){
    wasOpen=usersOpen();if(wasOpen)loadCode(true);
    installPasswordGuidance();
  });
}());
