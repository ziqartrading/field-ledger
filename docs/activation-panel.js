(function(){
'use strict';
const MIN=12;window.FL_PASSWORD_GUIDANCE_V390={version:'3.9.1',min:MIN};
function ps(){return typeof LANG!=='undefined'&&LANG==='ps';}
function checks(v){v=String(v||'');return{length:v.length>=MIN,upper:/[A-Z]/.test(v),lower:/[a-z]/.test(v),number:/[0-9]/.test(v)};}
function labels(){return ps()?{length:'لږ تر لږه ۱۲ توري',upper:'لږ تر لږه یو لوی انګلیسي توری (A–Z)',lower:'لږ تر لږه یو کوچنی انګلیسي توری (a–z)',number:'لږ تر لږه یوه شمېره (0–9)'}:{length:'at least 12 characters',upper:'at least one uppercase letter (A–Z)',lower:'at least one lowercase letter (a–z)',number:'at least one number (0–9)'};}
function install(input){if(!input||input.dataset.v390PasswordGuide)return;input.dataset.v390PasswordGuide='1';const box=document.createElement('div');box.className='fl-password-guide-v390';input.insertAdjacentElement('afterend',box);const render=()=>{const c=checks(input.value),l=labels();box.innerHTML=['length','upper','lower','number'].map(k=>`<span class="${c[k]?'ok':''}">${c[k]?'✓':'○'} ${l[k]}</span>`).join('');};input.addEventListener('input',render);render();}
function scan(){['acPass','pwdNew','pwdConfirm','changePass','newPassword'].forEach(id=>install(document.getElementById(id)));document.querySelectorAll('input[type="password"][data-password-new]').forEach(install);}
const style=document.createElement('style');style.textContent='.fl-password-guide-v390{display:grid;gap:3px;margin-top:7px;font-size:11px;color:var(--soft)}.fl-password-guide-v390 span.ok{color:#237a4a}';document.head.appendChild(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('field-ledger-language-changed',scan);
}());
