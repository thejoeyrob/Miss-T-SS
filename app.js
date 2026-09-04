(() => {
'use strict';
const $ = s => document.querySelector(s);
const view = $('#view');
const STORAGE = 'miss-thorne-shrubbery-ultimate-v2';
const TEAM_LIST = [
  {id:'capy', name:'Capybara Crew', short:'Capybaras', color:'#d9853b', goal:'Restoring the Riverside Habitat', mascot:'mascot-capy.png', scene:'scene-capy.png'},
  {id:'turtle', name:'Sea Turtle Squad', short:'Sea Turtles', color:'#299b91', goal:'Building an Ocean Sanctuary', mascot:'mascot-turtle.png', scene:'scene-turtle.png'},
  {id:'beaver', name:'Beaver Builders', short:'Beavers', color:'#91603d', goal:'Building the Wetland Dam', mascot:'mascot-beaver.png', scene:'scene-beaver.png'},
  {id:'panda', name:'Red Panda Rangers', short:'Red Pandas', color:'#d94f47', goal:'Creating a Canopy Refuge', mascot:'mascot-panda.png', scene:'scene-panda.png'}
];
const TEAM = Object.fromEntries(TEAM_LIST.map(t=>[t.id,t]));
const MATH_TOPICS = [
  ['Place Value','Autumn'],['Addition & Subtraction','Autumn'],['Area','Autumn'],['Multiplication & Division A','Autumn'],
  ['Multiplication & Division B','Spring'],['Length & Perimeter','Spring'],['Fractions','Spring'],['Decimals A','Spring'],
  ['Decimals B','Summer'],['Money','Summer'],['Time','Summer'],['Shape','Summer'],['Statistics','Summer'],['Position & Direction','Summer']
];
const SUBJECT_META = {
  'Maths':{icon:'123',tone:'#2878b5'},'English':{icon:'Aa',tone:'#8056b3'},'Science':{icon:'⚗',tone:'#4f9b59'},
  'History':{icon:'⌛',tone:'#c8783b'},'Geography':{icon:'🌍',tone:'#2e938e'},'Computing':{icon:'⌘',tone:'#5c72a7'},
  'Verbal Reasoning':{icon:'ABC',tone:'#c04f7d'},'Non-Verbal Reasoning':{icon:'🧩',tone:'#7a5bb4'}
};
const REASON_TOPICS = {'Verbal Reasoning':['Quick-Fire Word Logic'],'Non-Verbal Reasoning':['Quick-Fire Visual Logic']};
const POSES = {welcome:'miss-thorne-welcome.png',ask:'miss-thorne-ask.png',think:'miss-thorne-think.png',idea:'miss-thorne-idea.png',correct:'miss-thorne-correct.png',wrong:'miss-thorne-wrong.png',celebrate:'miss-thorne-celebrate.png',present:'miss-thorne-present.png'};

const defaults = () => ({
  screen:'welcome', playMode:'teams', active:['capy','turtle'], turnStyle:'ordered', steals:true,
  quizSource:'single', subject:'Maths', topic:'Place Value', mixed:['Maths|||Place Value','Maths|||Addition & Subtraction'],
  browseSubject:'Maths', answerMode:'classic', timer:0, muted:false,
  scores:{capy:0,turtle:0,beaver:0,panda:0,class:0}, turnOrder:[], turnIndex:0,
  question:null, questionNumber:0, hintUsed:false, selected:null, disabledOptions:[], phase:'answer',
  responder:null, attempted:[], isSteal:false, result:null, winner:null, undo:null, timerRemaining:0, lastQuestionText:''
});
let state = load();
let timerHandle = null, reactionHandle = null, audioCtx = null;

function load(){
  try { const raw = JSON.parse(localStorage.getItem(STORAGE)); return raw ? Object.assign(defaults(), raw) : defaults(); }
  catch(e){ return defaults(); }
}
function save(){ try{ localStorage.setItem(STORAGE, JSON.stringify(state)); }catch(e){} }
function resetGameOnly(){
  const keep = {playMode:state.playMode,active:[...state.active],turnStyle:state.turnStyle,steals:state.steals,quizSource:state.quizSource,subject:state.subject,topic:state.topic,mixed:[...state.mixed],browseSubject:state.browseSubject,answerMode:state.answerMode,timer:state.timer,muted:state.muted};
  state = Object.assign(defaults(), keep); save();
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function rand(n){
  if(globalThis.crypto?.getRandomValues){ const a=new Uint32Array(1); globalThis.crypto.getRandomValues(a); return a[0]%n; }
  return Math.floor(Math.random()*n);
}
function shuffle(a){ const x=[...a]; for(let i=x.length-1;i>0;i--){const j=rand(i+1); [x[i],x[j]]=[x[j],x[i]];} return x; }
function choice(a){ return a[rand(a.length)]; }
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function scoreText(v){ const whole=Math.floor(v), half=Math.abs(v-whole)>.1; return half ? `${whole}½` : String(whole); }
function currentOrderedTeam(){ return state.turnOrder[state.turnIndex] || state.active[0]; }
function actorId(){ if(state.playMode==='class') return 'class'; return state.turnStyle==='ordered' ? currentOrderedTeam() : state.responder; }
function actorName(id=actorId()){ return id==='class' ? 'Kings & Queens' : (TEAM[id]?.name || 'Open Question'); }
function topicList(subject){
  if(subject==='Maths') return MATH_TOPICS.map(([t,term])=>({topic:t,term}));
  if(REASON_TOPICS[subject]) return REASON_TOPICS[subject].map(t=>({topic:t,term:'Quick Fire'}));
  return Object.keys(window.LEGACY_LIB?.[subject]||{}).map(t=>({topic:t,term:'Year 4'}));
}
function allSubjects(){ return ['Maths','English','Science','History','Geography','Computing','Verbal Reasoning','Non-Verbal Reasoning']; }

function tone(type='ok'){
  if(state.muted) return;
  const A=window.AudioContext||window.webkitAudioContext; if(!A)return; audioCtx=audioCtx||new A();
  const map={ok:[523,659,784],bad:[230,185,150],click:[420],lock:[440,660],time:[330,280],win:[523,659,784,1047],shuffle:[300,420,550]};
  (map[type]||map.ok).forEach((f,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type==='bad'?'sawtooth':'triangle';o.frequency.value=f;g.gain.value=.04;o.connect(g);g.connect(audioCtx.destination);o.start(audioCtx.currentTime+i*.08);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+i*.08+.23);o.stop(audioCtx.currentTime+i*.08+.25);});
}
function react(pose,title,text,ms=2300){
  clearTimeout(reactionHandle); $('#reactionImg').src=POSES[pose]||POSES.welcome; $('#reactionTitle').textContent=title; $('#reactionText').textContent=text; $('#reaction').classList.add('show');
  reactionHandle=setTimeout(()=>$('#reaction').classList.remove('show'),ms);
}
function stopTimer(){ clearInterval(timerHandle); timerHandle=null; }
function startTimer(){
  stopTimer(); if(!state.timer || state.screen!=='game' || state.phase!=='answer') return;
  if(!state.timerRemaining) state.timerRemaining=state.timer;
  timerHandle=setInterval(()=>{
    state.timerRemaining=Math.max(0,state.timerRemaining-1); updateTimerChip();
    if(state.timerRemaining<=0){stopTimer();tone('time');react('idea','Time!','Teacher decides whether to allow the answer.',1800);}
  },1000);
}
function updateTimerChip(){ const el=$('#timerChip'); if(!el)return; el.textContent=`⏱ ${state.timerRemaining}s`; el.classList.toggle('hot',state.timerRemaining<=5); }

function render(){
  stopTimer();
  const f={welcome:renderWelcome,setup:renderSetup,shuffle:renderShuffle,game:renderGame,winner:renderWinner}[state.screen]||renderWelcome;
  f(); if(state.screen==='game') startTimer(); save();
}

function renderWelcome(){
  const resumable = ['shuffle','game','winner'].includes(state.screenBeforeHome||'') || !!state.question || state.questionNumber>0;
  view.innerHTML=`<section class="welcome">
    <div class="welcome-copy card">
      <span class="eyebrow">🌿 Year 4 • classroom game</span>
      <h1 class="title-xl">Shrubbery<br><span class="gold">Showdown</span></h1>
      <p class="lead">A big-screen quiz adventure built for Miss Thorne to run from an iPad or laptop while the class plays from their desks.</p>
      <div class="welcome-badges"><span class="tag green">2–4 teams</span><span class="tag purple">Kings & Queens class mode</span><span class="tag gold">Classic + Multiple Choice</span><span class="tag">Verbal + visual reasoning</span></div>
      <div class="welcome-actions"><button class="primary" data-act="setup">Start a Showdown</button><button class="ghost" data-act="help">How to Play</button></div>
      ${resumable?`<div class="resume-box"><div><b>Game in progress</b><div style="font-size:12px;color:#5e7765;margin-top:3px">Resume without losing scores or turn order.</div></div><button class="secondary" data-act="resume">Resume Game</button></div>`:''}
    </div>
    <div class="welcome-host card"><div class="host-quote">“Ready? Let’s see what Year 4 knows today!”</div><img src="${POSES.welcome}" alt="Miss Thorne welcoming the class"></div>
  </section>`;
}

function renderSetup(){
  const teamCards=TEAM_LIST.map(t=>`<button class="team-pick ${state.active.includes(t.id)?'selected':''}" style="--team:${t.color}" data-act="team" data-value="${t.id}"><img src="${t.mascot}" alt=""><b>${t.name}</b><small>${t.goal}</small></button>`).join('');
  const subjects=allSubjects().map(s=>`<button class="subject-pill ${state.browseSubject===s?'active':''}" data-act="browse-subject" data-value="${esc(s)}">${SUBJECT_META[s].icon} ${esc(s)}</button>`).join('');
  const topics=topicList(state.browseSubject).map(({topic,term})=>{
    const key=`${state.browseSubject}|||${topic}`, selected=state.quizSource==='single'?(state.subject===state.browseSubject&&state.topic===topic):state.mixed.includes(key);
    return `<button class="topic-choice ${state.quizSource==='mixed'?'check':''} ${selected?'selected':''}" data-act="topic" data-subject="${esc(state.browseSubject)}" data-value="${esc(topic)}"><b>${esc(topic)}</b><small>${esc(term)}</small></button>`;
  }).join('');
  const summary = setupSummary();
  view.innerHTML=`<section class="setup-shell">
    <div class="setup-head"><div><span class="eyebrow">Teacher setup</span><h1>Build today’s showdown</h1></div><button class="ghost" data-act="home">← Home</button></div>
    <div class="setup-grid">
      <div class="setup-card card"><span class="eyebrow">1 • Who is playing?</span><h2>Game structure</h2><p>Team Battle keeps the 2–4 animal teams. Kings & Queens plays as one whole class.</p>
        <div class="choice-grid">
          ${choiceCard('play','teams','🦫','Team Battle','2–4 teams race to complete their habitat.',state.playMode==='teams')}
          ${choiceCard('play','class','👑','Kings & Queens','The whole class works together to reveal the castle.',state.playMode==='class')}
        </div>
      </div>
      <div class="setup-card card"><span class="eyebrow">2 • How are answers taken?</span><h2>Answer style</h2><p>Classic rewards an unaided verbal answer. Multiple Choice starts with A–D and always awards the full point.</p>
        <div class="choice-grid">
          ${choiceCard('answer','classic','⚡','Classic','Answer aloud for 1 step, or reveal A–D for ½ step.',state.answerMode==='classic')}
          ${choiceCard('answer','mc','🔒','Multiple Choice','A–D from the start. Select, then Lock In Final Answer.',state.answerMode==='mc')}
        </div>
      </div>
      ${state.playMode==='teams'?`<div class="setup-card card setup-span"><span class="eyebrow">3 • Team setup</span><h2>Select 2, 3 or 4 teams</h2><p>The original team names and habitats are preserved. Choose how the class earns the right to answer.</p><div class="teams-grid">${teamCards}</div>
        <div style="height:12px"></div><div class="choice-grid">
          ${choiceCard('turn','ordered','🌱','Random Turn Order','A fun mascot burrow shuffle randomly reveals 1st, 2nd, 3rd and 4th turn.',state.turnStyle==='ordered')}
          ${choiceCard('turn','shout','🔔','Shout-Out / Buzzer','Teacher taps the team that buzzed or shouted first. Wrong answers can be stolen.',state.turnStyle==='shout')}
        </div>
        ${state.turnStyle==='shout'?`<div style="margin-top:10px"><button class="choice ${state.steals?'selected':''}" style="width:100%;min-height:78px" data-act="steals"><b>⚔ Steal on a wrong answer</b><span>After a miss, choose one other team to attempt the same question.</span></button></div>`:''}
      </div>`:''}
      <div class="setup-card card setup-span"><span class="eyebrow">${state.playMode==='teams'?'4':'3'} • What are we testing?</span><h2>Question source</h2><p>Single Topic is focused practice. Mixed Quiz lets you tick only content already taught.</p>
        <div class="choice-grid" style="margin-bottom:14px">
          ${choiceCard('source','single','📘','Single Topic','Choose one Year 4 curriculum area.',state.quizSource==='single')}
          ${choiceCard('source','mixed','🎲','Mixed Taught Topics','Randomly mix the topics you tick below.',state.quizSource==='mixed')}
        </div>
        <div class="subject-pills">${subjects}</div><div class="topics-grid">${topics}</div>
      </div>
      <div class="setup-card card"><span class="eyebrow">Quick-fire pace</span><h2>Optional countdown</h2><p>The timer adds energy but never marks an answer automatically. Miss Thorne stays in control.</p>
        <div class="choice-grid">${[0,20,30,45].map(n=>`<button class="choice ${state.timer===n?'selected':''}" style="min-height:72px" data-act="timer" data-value="${n}"><b>${n?`${n} seconds`:'No timer'}</b><span>${n?'Quick-fire countdown':'Teacher-led pace'}</span></button>`).join('')}</div>
      </div>
      <div class="setup-card card"><span class="eyebrow">Classroom-ready</span><h2>Built for the board</h2><p>Large text, touch-sized controls, fullscreen support, score undo and persistent game state are all enabled.</p><div class="welcome-badges"><span class="tag">iPad</span><span class="tag">Laptop</span><span class="tag">Whiteboard / TV</span><span class="tag">Offline PWA</span></div></div>
    </div>
    <div class="setup-footer"><div class="setup-summary">${summary}</div><button class="primary" data-act="launch">${state.playMode==='teams'&&state.turnStyle==='ordered'?'Go to Mascot Turn Draw →':'Start the Showdown →'}</button></div>
  </section>`;
}
function choiceCard(act,val,icon,title,copy,selected){ return `<button class="choice ${selected?'selected':''}" data-act="${act}" data-value="${val}"><div class="choice-icon">${icon}</div><b>${title}</b><span>${copy}</span></button>`; }
function setupSummary(){
  const q = state.quizSource==='single' ? `${state.subject}: ${state.topic}` : `${state.mixed.length} taught topics mixed`;
  const players = state.playMode==='class' ? 'Kings & Queens whole-class mode' : `${state.active.length} teams • ${state.turnStyle==='ordered'?'random turn order':'shout-out / buzzer'}${state.turnStyle==='shout'&&state.steals?' + steal':''}`;
  const answer = state.answerMode==='classic' ? 'Classic: full point unaided / ½ with choices' : 'Multiple Choice: full point + final-answer lock';
  return `<b>${esc(players)}</b><br>${esc(q)} • ${esc(answer)}${state.timer?` • ${state.timer}s timer`:''}`;
}

function renderShuffle(){
  const slots = state.active.map((id,i)=>`<div class="burrow-slot" data-team="${id}" style="--team:${TEAM[id].color}"><img class="burrow-mascot" src="${TEAM[id].mascot}" alt="${TEAM[id].name}"><div class="order-badge">?</div></div>`).join('');
  view.innerHTML=`<section class="shuffle-screen"><div class="shuffle-card card"><span class="eyebrow">Fair random draw</span><h1>Who pops up first?</h1><p class="shuffle-copy">The mascots will duck and dive, then emerge one-by-one to reveal today’s turn order.</p><div class="burrow-stage">${slots}</div><div id="shuffleResult" class="shuffle-result">Ready when you are.</div><div class="button-row" style="justify-content:center"><button id="shuffleButton" class="primary" data-act="shuffle-go">Shuffle the Burrows</button><button class="ghost" data-act="setup">Back to Setup</button></div></div></section>`;
  if(state.turnOrder.length===state.active.length && state.turnOrder.length){ setTimeout(()=>showExistingOrder(),40); }
}
function showExistingOrder(){
  state.turnOrder.forEach((id,index)=>{const slot=document.querySelector(`.burrow-slot[data-team="${id}"]`); if(slot){slot.classList.add('revealed');slot.querySelector('.order-badge').textContent=String(index+1);}});
  const r=$('#shuffleResult'); if(r)r.textContent=state.turnOrder.map((id,i)=>`${i+1}. ${TEAM[id].name}`).join('   •   ');
  const b=$('#shuffleButton'); if(b){b.textContent='Start Game →';b.dataset.act='shuffle-start';}
}
function runShuffle(){
  state.turnOrder=[]; save(); const slots=[...document.querySelectorAll('.burrow-slot')], button=$('#shuffleButton'); if(button)button.disabled=true;
  slots.forEach(s=>{s.classList.remove('revealed');s.classList.add('shuffling');s.querySelector('.order-badge').textContent='?';}); $('#shuffleResult').textContent='They’re peeping… keep watching!'; tone('shuffle');
  const order=shuffle(state.active); setTimeout(()=>{
    slots.forEach(s=>s.classList.remove('shuffling'));
    order.forEach((id,i)=>setTimeout(()=>{const slot=document.querySelector(`.burrow-slot[data-team="${id}"]`); if(slot){slot.classList.add('revealed');slot.querySelector('.order-badge').textContent=String(i+1);} tone('click'); if(i===order.length-1){state.turnOrder=order;save();$('#shuffleResult').textContent=order.map((x,j)=>`${j+1}. ${TEAM[x].name}`).join('   •   '); button.disabled=false;button.textContent='Start Game →';button.dataset.act='shuffle-start';react('celebrate','Turn order set!',`${TEAM[order[0]].name} takes Question 1.`,1900);}},650+i*650));
  },1450);
}

function renderGame(){
  if(!state.question){newQuestion(false);return;}
  const actor=actorId(); const currentTeam=actor&&actor!=='class'?TEAM[actor]:null;
  const turnHTML = state.playMode==='class' ? `<span class="turn-pill" style="--team:#8b6a20">👑 Kings & Queens • Whole Class</span>` : state.turnStyle==='ordered' ? `<span class="turn-pill" style="--team:${TEAM[currentOrderedTeam()].color}"><img src="${TEAM[currentOrderedTeam()].mascot}" alt="">${TEAM[currentOrderedTeam()].name}'s turn</span>` : `<span class="turn-pill" style="--team:${currentTeam?.color||'#7257bd'}">${currentTeam?`<img src="${currentTeam.mascot}" alt="">${currentTeam.name} answering`:'🔔 Open shout-out question'}</span>`;
  const hostPose = state.phase==='result' ? (state.result?.correct?'correct':'wrong') : state.hintUsed?'think':'ask';
  const hostMsg = state.phase==='steal-select' ? 'Steal chance! Who wants it?' : state.phase==='result' ? (state.result?.correct?'That moved the build on!':'No worries — keep the pace up.') : state.answerMode==='mc' ? 'Choose carefully, then lock it in.' : state.hintUsed ? 'The choices are up — this one is worth half a step.' : 'Answer aloud for the full step.';
  view.innerHTML=`<section class="game-shell">
    <aside class="host-panel card"><div class="host-title">Miss Thorne</div><div class="host-speech">${esc(hostMsg)}</div><img src="${POSES[hostPose]}" alt="Miss Thorne"></aside>
    <section class="question-panel card">
      <div class="game-topline"><div>${turnHTML}</div><div style="display:flex;gap:7px;align-items:center"><span class="tag">Question ${state.questionNumber}</span>${state.timer?`<span id="timerChip" class="timer-chip ${state.timerRemaining<=5?'hot':''}">⏱ ${state.timerRemaining}s</span>`:''}</div></div>
      ${renderQuestionCard()}
      <div class="answer-zone">${renderAnswerZone()}</div>
      ${renderTeacherDock()}
    </section>
    <aside class="progress-panel card"><div class="progress-title"><h2>${state.playMode==='class'?'Castle Progress':'Team Progress'}</h2><span class="tag gold">Race to 10</span></div>${renderProgress()}</aside>
  </section>`;
}
function renderQuestionCard(){
  const q=state.question; let visual='';
  if(q.visualSeq){ visual=`<div class="visual-sequence">${q.visualSeq.map(id=>`<img src="${TEAM[id].mascot}" alt="${TEAM[id].short}">`).join('')}<span class="visual-qmark">?</span></div>`; }
  return `<div class="question-card"><div class="question-subject">${esc(q.subject)} • ${esc(q.topic)}</div><div class="question-text">${esc(q.q)}</div>${visual}${q.sub?`<div class="question-explain">${esc(q.sub)}</div>`:''}</div>`;
}
function renderAnswerZone(){
  if(state.phase==='result') return `<div class="result-strip ${state.result.correct?'correct':'wrong'}"><b>${state.result.correct?'Correct!':'Not quite.'}</b> ${esc(state.result.message)}<br><span>${esc(state.question.e||'')}</span></div>`;
  if(state.phase==='steal-select'){
    const available=state.active.filter(id=>!state.attempted.includes(id));
    return `<div class="steal-banner"><b>⚔ STEAL!</b><span>The first answer missed. Choose one other team for a single steal attempt.</span></div><div class="responder-grid">${available.map(id=>teamAction(id,'steal-team')).join('')}</div>`;
  }
  if(state.playMode==='teams'&&state.turnStyle==='shout'&&!state.responder){
    return `<div class="responder-box"><h3>🔔 Who buzzed or shouted first?</h3><p>Tap the team before taking the answer.</p><div class="responder-grid">${state.active.map(id=>teamAction(id,'responder')).join('')}</div></div>`;
  }
  if(state.answerMode==='classic'&&!state.hintUsed){
    return `<div class="classic-actions"><button class="mark-btn mark-correct" data-act="mark" data-value="correct">✓ Mark Correct <small>+1</small></button><button class="mark-btn mark-wrong" data-act="mark" data-value="wrong">× Not Quite</button></div><button class="hint-btn" data-act="hint">💡 Reveal A–D choices — correct answer becomes worth ½ step</button>`;
  }
  return renderChoices();
}
function renderChoices(){
  const q=state.question; const letters=['A','B','C','D'];
  const opts=q.options.map((opt,i)=>{
    const sel=state.selected===opt, disabled=state.disabledOptions.includes(opt), visual=q.visualOptions;
    return `<button class="mc-option ${sel?'selected':''} ${disabled?'disabled-wrong':''} ${visual?'visual-option':''}" data-act="option" data-value="${esc(opt)}" ${disabled?'disabled':''}><span class="letter">${letters[i]}</span>${visual?`<img src="${TEAM[opt].mascot}" alt="${TEAM[opt].name}">`:`<span>${esc(opt)}</span>`}</button>`;
  }).join('');
  const value=state.answerMode==='classic'?'½ step':'1 full step';
  const label=state.answerMode==='classic'?'Submit ½-Point Answer':'Lock In Final Answer';
  return `<div class="mc-grid">${opts}</div><div class="lock-row"><span class="lock-note">Correct = ${value}</span><button class="primary lock-btn" data-act="lock" ${state.selected?'':'disabled'}>🔒 ${label}</button></div>`;
}
function teamAction(id,act){ const t=TEAM[id]; return `<button class="team-action" style="--team:${t.color}" data-act="${act}" data-value="${id}"><img src="${t.mascot}" alt=""><b>${t.name}</b></button>`; }
function renderTeacherDock(){
  const next = state.phase==='result' ? `<button class="dock-btn" data-act="next">${state.winner?'See Winner →':'Next Question →'}</button>` : '';
  const pass = state.playMode==='teams'&&state.turnStyle==='ordered'&&state.phase==='answer' ? `<button class="dock-btn" data-act="pass">Pass Turn</button>`:'';
  return `<div class="teacher-dock"><span class="dock-info">Teacher controls</span>${state.undo?`<button class="dock-btn" data-act="undo">↶ Undo last mark</button>`:''}<button class="dock-btn" data-act="skip">Skip question</button>${pass}${next}<button class="dock-btn" data-act="setup">Setup</button></div>`;
}
function renderProgress(){
  if(state.playMode==='class') return `<div class="progress-stack class-progress">${progressCard({id:'class',name:'Kings & Queens',goal:'Build the Shrubbery Castle',color:'#8c6a22',scene:'scene-castle.png'},state.scores.class)}</div>`;
  return `<div class="progress-stack">${state.active.map(id=>progressCard(TEAM[id],state.scores[id])).join('')}</div>`;
}
function progressCard(t,score){
  const pct=clamp(score/10*100,0,100), clip=100-pct, dots=Array.from({length:10},(_,i)=>`<span class="step-dot ${score>=i+1?'done':''}"></span>`).join('');
  return `<div class="progress-card" style="--team:${t.color};--clip:${clip}%"><div class="progress-scene" style="background-image:url('${t.scene}')"></div><div class="progress-reveal" style="background-image:url('${t.scene}')"></div><div class="progress-overlay"></div><div class="progress-info"><b>${esc(t.name)}</b><small>${esc(t.goal)}</small><div class="progress-score">${scoreText(score)}<span style="font-size:12px"> / 10</span></div><div class="step-dots">${dots}</div></div></div>`;
}

function renderWinner(){
  stopTimer(); const confetti=Array.from({length:36},(_,i)=>`<i class="confetti-piece" style="left:${rand(100)}%;--c:${['#f5c94a','#5aa862','#6f56b5','#d95450','#3da8d1'][i%5]};--t:${3+rand(4)}s;--d:-${rand(30)/10}s;--r:${rand(180)}deg;--x:${rand(240)-120}px"></i>`).join('');
  if(state.playMode==='class'){
    view.innerHTML=`<section class="winner">${confetti}<div class="winner-main card"><span class="eyebrow">👑 Castle complete</span><h1>Kings & Queens!</h1><p>The class reached 10 steps together. Brilliant teamwork.</p><img src="scene-castle.png" alt="Completed castle" style="width:100%;max-height:390px;object-fit:cover;border-radius:22px;box-shadow:var(--soft)"><div class="button-row" style="justify-content:center;margin-top:18px"><button class="primary" data-act="again">Play Again</button><button class="ghost" data-act="setup-new">Change Setup</button></div></div><div class="winner-host card"><div class="host-quote">“Castle complete! That was proper Year 4 teamwork.”</div><img src="${POSES.celebrate}" alt="Miss Thorne celebrating"></div></section>`;
    tone('win'); return;
  }
  const ranked=[...state.active].sort((a,b)=>state.scores[b]-state.scores[a]); const maxHeights=[190,145,115,90];
  const podium=ranked.map((id,i)=>`<div class="podium-team" style="--team:${TEAM[id].color}"><img src="${TEAM[id].mascot}" alt="${TEAM[id].name}"><b>${TEAM[id].name} • ${scoreText(state.scores[id])}</b><div class="podium-step" style="--h:${maxHeights[i]}px">${i+1}</div></div>`).join('');
  view.innerHTML=`<section class="winner">${confetti}<div class="winner-main card"><span class="eyebrow">🏆 Showdown complete</span><h1>${esc(TEAM[ranked[0]].name)}!</h1><p>First to complete all 10 progression steps.</p><div class="podium">${podium}</div><div class="button-row" style="justify-content:center"><button class="primary" data-act="again">Play Again</button><button class="ghost" data-act="setup-new">Change Setup</button></div></div><div class="winner-host card"><div class="host-quote">“What a finish! Great effort from every team.”</div><img src="${POSES.celebrate}" alt="Miss Thorne celebrating"></div></section>`;
  tone('win');
}

/* Questions */
function makeQuestion(){
  let subject=state.subject, topic=state.topic;
  if(state.quizSource==='mixed'){
    const key=choice(state.mixed); [subject,topic]=key.split('|||');
  }
  let q;
  if(subject==='Maths') q=mathQuestion(topic);
  else if(subject==='Verbal Reasoning') q=verbalQuestion();
  else if(subject==='Non-Verbal Reasoning') q=visualReasoningQuestion();
  else q=legacyQuestion(subject,topic);
  q.subject=subject;q.topic=topic;
  if(!q.options) q.options=shuffle([q.a,...(q.d||[])]).slice(0,4);
  if(q.options.length<4){ const fill=['None of these','All of these','Not enough information','Another answer']; for(const x of fill){if(q.options.length>=4)break;if(!q.options.includes(x)&&x!==q.a)q.options.push(x);} }
  return q;
}
function legacyQuestion(subject,topic){
  const pool=window.LEGACY_LIB?.[subject]?.[topic]||[]; if(!pool.length) return {q:'Which answer is correct?',a:'A',d:['B','C','D'],e:'Choose the best answer.'};
  let item=choice(pool); for(let i=0;i<6&&item.q===state.lastQuestionText;i++) item=choice(pool); return {...item};
}
function uniqueOpts(answer,arr){ const out=[String(answer)]; for(const x of arr){const s=String(x);if(!out.includes(s))out.push(s);if(out.length===4)break;} while(out.length<4)out.push(String((Number(answer)||0)+out.length)); return shuffle(out); }
function qnum(q,a,cands,e){return {q,a:String(a),options:uniqueOpts(a,cands),e};}
function mathQuestion(topic){
  let a,b,n,ans;
  switch(topic){
    case 'Place Value':{
      const type=rand(4); n=1000+rand(8000);
      if(type===0){const places=[['thousands',1000],['hundreds',100],['tens',10],['ones',1]],p=choice(places),digit=Math.floor(n/p[1])%10;ans=String(digit*p[1]);return qnum(`What is the value of the ${digit} in ${n.toLocaleString()}?`,ans,[digit, digit*10, digit*100, digit*1000],`The ${p[0]} digit is worth ${ans}.`)}
      if(type===1){ans=n+1000;return qnum(`What is 1,000 more than ${n.toLocaleString()}?`,ans,[n+100,n-1000,n+1100],`${n.toLocaleString()} + 1,000 = ${ans.toLocaleString()}.`)}
      if(type===2){const step=choice([10,100,1000]);ans=Math.round(n/step)*step;return qnum(`Round ${n.toLocaleString()} to the nearest ${step.toLocaleString()}.`,ans,[Math.floor(n/step)*step,Math.ceil(n/step)*step,ans+step],`Look at the digit immediately to the right of the rounding place.`)}
      a=1000+rand(7000);b=1000+rand(7000);ans=Math.max(a,b);return {q:`Which number is greater: ${a.toLocaleString()} or ${b.toLocaleString()}?`,a:String(ans),options:uniqueOpts(ans,[Math.min(a,b),Math.abs(a-b),a+b]),e:`${ans.toLocaleString()} is greater.`};
    }
    case 'Addition & Subtraction':{
      if(rand(2)){a=200+rand(3700);b=100+rand(1900);ans=a+b;return qnum(`${a.toLocaleString()} + ${b.toLocaleString()} = ?`,ans,[ans+10,ans-100,ans+100],`${a.toLocaleString()} + ${b.toLocaleString()} = ${ans.toLocaleString()}.`)}
      a=1500+rand(6500);b=100+rand(Math.min(2200,a-50));ans=a-b;return qnum(`${a.toLocaleString()} − ${b.toLocaleString()} = ?`,ans,[ans+10,ans-100,ans+100],`${a.toLocaleString()} − ${b.toLocaleString()} = ${ans.toLocaleString()}.`);
    }
    case 'Area':{
      a=2+rand(10);b=2+rand(8);ans=a*b;return qnum(`A rectangle is ${a} cm long and ${b} cm wide. What is its area?`,`${ans} cm²`,[`${a+b} cm²`,`${2*(a+b)} cm²`,`${ans+2} cm²`],`Area = length × width = ${a} × ${b} = ${ans} cm².`);
    }
    case 'Multiplication & Division A':{
      a=choice([3,6,7,9,11,12]);b=2+rand(11); if(rand(2)){ans=a*b;return qnum(`${a} × ${b} = ?`,ans,[ans+a,ans-a,a+b],`${a} × ${b} = ${ans}.`)} ans=a*b;return qnum(`${ans} ÷ ${a} = ?`,b,[b+1,b-1,a],`${ans} ÷ ${a} = ${b}.`);
    }
    case 'Multiplication & Division B':{
      const type=rand(3); if(type===0){a=10+rand(89);b=choice([10,100]);ans=a*b;return qnum(`${a} × ${b} = ?`,ans,[a*(b/10),ans+100,ans-100],`Multiplying by ${b} shifts the digits ${b===10?'one':'two'} place${b===10?'':'s'}.`)}
      if(type===1){a=10+rand(89);b=2+rand(8);ans=a*b;return qnum(`${a} × ${b} = ?`,ans,[ans+b,ans-b,a+b],`${a} × ${b} = ${ans}.`)}
      a=(2+rand(9))*100;b=choice([10,100]);ans=a/b;return qnum(`${a} ÷ ${b} = ?`,ans,[ans*10,ans+10,ans-1],`${a} ÷ ${b} = ${ans}.`);
    }
    case 'Length & Perimeter':{
      const type=rand(3); if(type===0){a=2+rand(18);ans=a*10;return qnum(`${a} cm is how many millimetres?`,`${ans} mm`,[`${a} mm`,`${a*100} mm`,`${ans+10} mm`],`1 cm = 10 mm, so ${a} cm = ${ans} mm.`)}
      if(type===1){a=2+rand(10);b=2+rand(9);ans=2*(a+b);return qnum(`What is the perimeter of a ${a} cm by ${b} cm rectangle?`,`${ans} cm`,[`${a*b} cm`,`${a+b} cm`,`${ans+2} cm`],`Perimeter = ${a}+${b}+${a}+${b} = ${ans} cm.`)}
      a=1+rand(8);ans=a*1000;return qnum(`${a} km is how many metres?`,`${ans.toLocaleString()} m`,[`${a*100} m`,`${a*10} m`,`${(ans+100).toLocaleString()} m`],`1 km = 1,000 m.`);
    }
    case 'Fractions':{
      const type=rand(3); if(type===0){const den=choice([4,6,8,10,12]);const num=1+rand(Math.floor(den/2));ans=num*2;return qnum(`Which fraction is equivalent to ${num}/${den}?`,`${ans}/${den*2}`,[`${num+1}/${den*2}`,`${num}/${den*2}`,`${ans}/${den}`],`Multiply numerator and denominator by 2.`)}
      if(type===1){const den=choice([2,4,5,8,10]);a=den*(2+rand(8));const num=1+rand(den-1);ans=a/den*num;return qnum(`What is ${num}/${den} of ${a}?`,ans,[a/den,ans+num,ans-num],`Find one ${den}th, then multiply by ${num}.`)}
      const den=choice([5,6,8,10]);a=1+rand(den-2);b=1+rand(den-a-1);ans=a+b;return qnum(`${a}/${den} + ${b}/${den} = ?`,`${ans}/${den}`,[`${ans}/${den*2}`,`${a*b}/${den}`,`${ans+1}/${den}`],`Same denominator: add the numerators.`);
    }
    case 'Decimals A':{
      const type=rand(3); if(type===0){a=1+rand(9);b=rand(10);ans=`${a}.${b}`;return qnum(`Which decimal has ${a} ones and ${b} tenths?`,ans,[`${b}.${a}`,`${a}${b}`,`0.${a}${b}`],`${a} ones and ${b} tenths is ${ans}.`)}
      if(type===1){a=10+rand(890);ans=(a/10).toFixed(1).replace(/\.0$/,'');return qnum(`${a} ÷ 10 = ?`,ans,[a/100,a*10,(a+10)/10],`Dividing by 10 moves every digit one place right.`)}
      a=1+rand(8);b=1+rand(9);ans=(a+b/10).toFixed(1);return qnum(`What is ${a} + ${b}/10 as a decimal?`,ans,[(a+b/100).toFixed(2),(a+b).toFixed(1),`${b}.${a}`],`${b}/10 = 0.${b}.`);
    }
    case 'Decimals B':{
      const type=rand(3); if(type===0){a=(rand(90)+10)/100;b=(rand(90)+10)/100;ans=Math.max(a,b).toFixed(2);return qnum(`Which is greater: ${a.toFixed(2)} or ${b.toFixed(2)}?`,ans,[Math.min(a,b).toFixed(2),(a+b).toFixed(2),Math.abs(a-b).toFixed(2)],`Compare tenths first, then hundredths.`)}
      if(type===1){a=(rand(90)+10)/100;ans=(1-a).toFixed(2);return qnum(`What must be added to ${a.toFixed(2)} to make 1.00?`,ans,[(1-a+.1).toFixed(2),a.toFixed(2),(1-a-.1).toFixed(2)],`${a.toFixed(2)} + ${ans} = 1.00.`)}
      a=(rand(49)+10)/10;ans=Math.round(a);return qnum(`Round ${a.toFixed(1)} to the nearest whole number.`,ans,[Math.floor(a),Math.ceil(a)+1,Math.floor(a)-1],`Look at the tenths digit.`);
    }
    case 'Money':{
      const type=rand(2); if(type===0){a=100+rand(800);b=50+rand(500);ans=a+b;return qnum(`A book costs £${(a/100).toFixed(2)} and a game costs £${(b/100).toFixed(2)}. What is the total?`,`£${(ans/100).toFixed(2)}`,[`£${((ans+100)/100).toFixed(2)}`,`£${((ans-50)/100).toFixed(2)}`,`£${((a-b)/100).toFixed(2)}`],`Add the pounds and pence carefully.`)}
      a=100+rand(700);const paid=choice([1000,2000]);ans=paid-a;return qnum(`You pay £${(paid/100).toFixed(2)} for something costing £${(a/100).toFixed(2)}. What change do you get?`,`£${(ans/100).toFixed(2)}`,[`£${((ans+100)/100).toFixed(2)}`,`£${((paid+a)/100).toFixed(2)}`,`£${(a/100).toFixed(2)}`],`Change = amount paid − cost.`);
    }
    case 'Time':{
      const type=rand(3); if(type===0){a=1+rand(4);b=choice([15,30,45]);ans=a*60+b;return qnum(`${a} hour${a>1?'s':''} ${b} minutes is how many minutes?`,`${ans} minutes`,[`${a*60} minutes`,`${ans+15} minutes`,`${a*100+b} minutes`],`1 hour = 60 minutes.`)}
      if(type===1){a=choice([15,20,25,30,35,40,45]);const startH=9+rand(5),startM=choice([0,15,30]);let total=startH*60+startM+a;let hh=Math.floor(total/60),mm=total%60;ans=`${hh}:${String(mm).padStart(2,'0')}`;return qnum(`It is ${startH}:${String(startM).padStart(2,'0')}. What time will it be in ${a} minutes?`,ans,[`${hh}:${String((mm+10)%60).padStart(2,'0')}`,`${startH}:${String((startM+a)%60).padStart(2,'0')}`,`${hh+1}:${String(mm).padStart(2,'0')}`],`Add ${a} minutes to the starting time.`)}
      ans='60';return qnum('How many seconds are in one minute?',ans,['100','30','24'],'1 minute = 60 seconds.');
    }
    case 'Shape':{
      const bank=[
        {q:'An angle smaller than 90° is called…',a:'acute',d:['obtuse','reflex','right'],e:'An acute angle is less than 90°.'},
        {q:'An angle greater than 90° but less than 180° is called…',a:'obtuse',d:['acute','right','straight'],e:'An obtuse angle lies between 90° and 180°.'},
        {q:'How many lines of symmetry does a square have?',a:'4',d:['1','2','8'],e:'A square has four lines of symmetry.'},
        {q:'How many sides does a hexagon have?',a:'6',d:['5','7','8'],e:'A hexagon has six sides.'},
        {q:'Which quadrilateral has two pairs of parallel sides and four right angles?',a:'rectangle',d:['kite','trapezium','triangle'],e:'A rectangle has four right angles and opposite sides parallel.'}
      ]; return {...choice(bank)};
    }
    case 'Statistics':{
      const cats=['red','blue','green','yellow'],vals=cats.map(()=>2+rand(12)),idx=rand(4),j=(idx+1+rand(3))%4;ans=Math.abs(vals[idx]-vals[j]);return qnum(`A class chart shows ${vals[idx]} ${cats[idx]} votes and ${vals[j]} ${cats[j]} votes. What is the difference?`,ans,[vals[idx]+vals[j],ans+1,Math.min(vals[idx],vals[j])],`Difference means subtract the smaller number from the larger.`);
    }
    case 'Position & Direction':{
      const type=rand(2); if(type===0){a=1+rand(7);b=1+rand(7);const dx=1+rand(3);ans=`(${a+dx}, ${b})`;return qnum(`A point is at (${a}, ${b}). Move it ${dx} square${dx>1?'s':''} right. Where is it now?`,ans,[`(${a}, ${b+dx})`,`(${a-dx}, ${b})`,`(${a+dx}, ${b+dx})`],`Moving right increases the x-coordinate.`)}
      a=1+rand(7);b=1+rand(7);const dy=1+rand(3);ans=`(${a}, ${b+dy})`;return qnum(`A point is at (${a}, ${b}). Move it ${dy} square${dy>1?'s':''} up. Where is it now?`,ans,[`(${a+dy}, ${b})`,`(${a}, ${b-dy})`,`(${a+dy}, ${b+dy})`],`Moving up increases the y-coordinate.`);
    }
    default:return mathQuestion('Place Value');
  }
}
const VERBAL_BANK=[
  ['Which word means the same as “rapid”?','quick',['slow','quiet','heavy'],'Rapid means quick or fast.'],
  ['Which word is the opposite of “ancient”?','modern',['historic','old','broken'],'Modern is the opposite of ancient.'],
  ['Bird is to nest as bee is to…','hive',['web','stable','burrow'],'A bee lives in a hive.'],
  ['Puppy is to dog as kitten is to…','cat',['cub','foal','calf'],'A kitten is a young cat.'],
  ['Which word does not belong: apple, pear, carrot, plum?','carrot',['apple','pear','plum'],'Carrot is a vegetable; the others are fruits.'],
  ['Which word comes first alphabetically?','bridge',['brick','bright','bring'],'Compare the letters from left to right.'],
  ['Complete the pair: hot : cold :: up : …','down',['high','over','top'],'These are opposites.'],
  ['Which word means “to look carefully”?','inspect',['ignore','scatter','whisper'],'Inspect means to look at something carefully.'],
  ['Which word is closest in meaning to “fortunate”?','lucky',['angry','tired','empty'],'Fortunate means lucky.'],
  ['Which word is the odd one out: whisper, shout, speak, bicycle?','bicycle',['whisper','shout','speak'],'Three are ways of using your voice.'],
  ['If CAT becomes DBU by moving every letter on one, DOG becomes…','EPH',['CPH','EOG','FPH'],'D→E, O→P, G→H.'],
  ['Which word can go after “rain” to make a new word?','bow',['chair','stone','desk'],'Rain + bow = rainbow.'],
  ['Which word can go before “ball” to make a new word?','foot',['book','tree','rain'],'Foot + ball = football.'],
  ['Choose the best analogy: hand is to glove as foot is to…','sock',['hat','belt','scarf'],'A glove covers a hand; a sock covers a foot.'],
  ['Which is the strongest word? warm, hot, boiling, mild','boiling',['warm','hot','mild'],'Boiling describes the greatest heat.'],
  ['If all Mips are blue and this is a Mip, what must be true?','It is blue',['It is red','It can fly','It is large'],'The rule says every Mip is blue.'],
  ['Which word has the same relationship: teacher : school :: doctor : …','hospital',['library','garage','stadium'],'A doctor commonly works in a hospital.'],
  ['Which word is made from the letters in LISTEN?','silent',['little','stone','least'],'SILENT uses exactly the same letters as LISTEN.'],
  ['Which word means the opposite of “increase”?','decrease',['improve','repeat','collect'],'Decrease means to become less.'],
  ['Which word is most similar to “enormous”?','huge',['tiny','narrow','gentle'],'Enormous means huge.']
];
function verbalQuestion(){ const x=choice(VERBAL_BANK); return {q:x[0],a:x[1],d:x[2],e:x[3]}; }
function visualReasoningQuestion(){
  const ids=shuffle(TEAM_LIST.map(t=>t.id)),type=rand(5); let seq,ans,e;
  if(type===0){const [a,b]=ids;seq=[a,b,a,b,a];ans=b;e='The pattern alternates A, B, A, B…';}
  else if(type===1){const [a,b]=ids;seq=[a,a,b,a,a];ans=b;e='The repeating unit is A, A, B.';}
  else if(type===2){const [a,b,c]=ids;seq=[a,b,c,a,b];ans=c;e='The repeating unit is A, B, C.';}
  else if(type===3){const [a,b]=ids;seq=[a,b,b,a,a];ans=b;e='The pattern repeats A, B, B.';}
  else {const [a,b,c]=ids;seq=[a,b,a,c,a,b,a];ans=c;e='Every other mascot is A; the gaps repeat B, C, B, C.';}
  return {q:'Which mascot comes next?',a:ans,options:shuffle(TEAM_LIST.map(t=>t.id)),e,visualSeq:seq,visualOptions:true};
}

function newQuestion(advance=true){
  stopTimer(); state.question=makeQuestion(); if(state.question.q===state.lastQuestionText) state.question=makeQuestion(); state.lastQuestionText=state.question.q;
  state.questionNumber += 1; state.hintUsed=false;state.selected=null;state.disabledOptions=[];state.phase='answer';state.responder=null;state.attempted=[];state.isSteal=false;state.result=null;state.winner=null;state.undo=null;state.timerRemaining=state.timer; save(); render();
}
function beginGame(){
  state.scores={capy:0,turtle:0,beaver:0,panda:0,class:0};state.turnIndex=0;state.questionNumber=0;state.question=null;state.winner=null;state.undo=null;
  if(state.playMode==='teams'&&state.turnStyle==='ordered'&&!state.turnOrder.length) state.turnOrder=shuffle(state.active);
  state.screen='game';save();newQuestion(false);
}
function validateSetup(){
  if(state.playMode==='teams'&&(state.active.length<2||state.active.length>4)) return 'Choose between 2 and 4 teams.';
  if(state.quizSource==='mixed'&&state.mixed.length<2) return 'Choose at least 2 taught topics for Mixed Quiz.';
  if(state.quizSource==='single'&&!state.topic) return 'Choose a topic.';
  return '';
}
function launch(){
  const err=validateSetup(); if(err){react('wrong','Nearly there',err,2200);return;}
  state.scores={capy:0,turtle:0,beaver:0,panda:0,class:0};state.question=null;state.questionNumber=0;state.turnIndex=0;state.winner=null;state.undo=null;
  if(state.playMode==='teams'&&state.turnStyle==='ordered'){state.turnOrder=[];state.screen='shuffle';render();}
  else beginGame();
}
function snapshot(){ state.undo=JSON.stringify({scores:state.scores,turnIndex:state.turnIndex,phase:state.phase,responder:state.responder,attempted:state.attempted,isSteal:state.isSteal,result:state.result,winner:state.winner,selected:state.selected,disabledOptions:state.disabledOptions,hintUsed:state.hintUsed}); }
function undo(){
  if(!state.undo)return; try{const u=JSON.parse(state.undo);Object.assign(state,u);state.undo=null;tone('click');render();}catch(e){state.undo=null;}
}
function markClassic(correct){
  if(state.phase!=='answer')return;snapshot(); const value=1; if(correct) applyCorrect(value); else applyWrong(value);
}
function confirmLock(){
  if(!state.selected)return;
  if(state.answerMode==='mc'){
    const idx=state.question.options.indexOf(state.selected),letter=['A','B','C','D'][idx];
    const body=state.question.visualOptions?`<div class="confirm-choice"><span class="letter">${letter}</span><img src="${TEAM[state.selected].mascot}" style="width:92px;height:92px;object-fit:contain" alt=""><span>${TEAM[state.selected].name}</span></div>`:`<div class="confirm-choice"><span class="letter">${letter}</span><span>${esc(state.selected)}</span></div><p style="margin:14px 0 0">Once locked, this answer is marked immediately.</p>`;
    openModal('Lock in your final answer?',body,[['Go Back','ghost',closeModal],['🔒 Lock It In','primary',()=>{closeModal();evaluateChoice();}]]);
  } else evaluateChoice();
}
function evaluateChoice(){ if(!state.selected||state.phase!=='answer')return;snapshot(); tone('lock'); const value=state.answerMode==='classic'?.5:1; if(String(state.selected)===String(state.question.a))applyCorrect(value);else applyWrong(value); }
function applyCorrect(value){
  const actor=actorId(); if(!actor)return; state.scores[actor]=clamp((state.scores[actor]||0)+value,0,10); state.phase='result'; state.result={correct:true,message:`${actorName(actor)} earns ${value===.5?'½ a step':'1 full step'}.`}; state.winner=state.scores[actor]>=10?actor:null; tone('ok'); react('correct','Correct!',value===.5?'Half a step added.':'Full step added.'); save();render();
}
function applyWrong(value){
  const actor=actorId(); if(state.playMode==='class'){
    state.phase='result';state.result={correct:false,message:'No step this time — the castle progress stays safe.'};tone('bad');react('wrong','Not quite',`The answer was ${displayAnswer(state.question.a)}.`);save();render();return;
  }
  if(state.turnStyle==='shout'&&state.steals&&!state.isSteal){
    if(actor&&!state.attempted.includes(actor))state.attempted.push(actor); state.phase='steal-select'; if(state.selected)state.disabledOptions=[...new Set([...state.disabledOptions,state.selected])];state.selected=null; tone('bad');react('wrong','Steal available!','Pick one other team for the steal.',1800);save();render();return;
  }
  state.phase='result';state.result={correct:false,message:`The correct answer was ${displayAnswer(state.question.a)}.`};tone('bad');react('wrong','Not quite',`Answer: ${displayAnswer(state.question.a)}`);save();render();
}
function displayAnswer(a){return state.question.visualOptions?(TEAM[a]?.name||a):String(a);}
function nextQuestion(){
  if(state.winner){state.screen='winner';state.question=null;save();render();return;}
  if(state.playMode==='teams'&&state.turnStyle==='ordered')state.turnIndex=(state.turnIndex+1)%state.turnOrder.length;
  newQuestion();
}
function skipQuestion(){ react('idea','Question skipped','No score change.',1200); newQuestion(); }
function passTurn(){ if(state.playMode==='teams'&&state.turnStyle==='ordered'){state.turnIndex=(state.turnIndex+1)%state.turnOrder.length;newQuestion();} }
function playAgain(){
  state.scores={capy:0,turtle:0,beaver:0,panda:0,class:0};state.question=null;state.questionNumber=0;state.turnIndex=0;state.winner=null;state.undo=null;
  if(state.playMode==='teams'&&state.turnStyle==='ordered'){state.turnOrder=[];state.screen='shuffle';render();}else beginGame();
}

/* Modal / help */
function openModal(title,body,actions=[]){
  $('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;const a=$('#modalActions');a.innerHTML='';actions.forEach(([label,cls,fn])=>{const b=document.createElement('button');b.className=cls;b.textContent=label;b.onclick=fn;a.appendChild(b);});$('#modal').hidden=false;
}
function closeModal(){ $('#modal').hidden=true; }
function showHelp(){
  openModal('How to Play',`<h3>Team Battle</h3><p>Choose 2–4 teams. In <b>Random Turn Order</b>, the mascot burrow shuffle fairly sets the order. In <b>Shout-Out / Buzzer</b>, the teacher taps whichever team buzzed or shouted first.</p>
  <h3>Classic answers</h3><p>Answer aloud with no choices for <b>1 full step</b>. If the class needs help, reveal A–D; a correct answer is then worth <b>½ step</b>.</p>
  <h3>Multiple Choice</h3><p>A–D is visible immediately and a correct answer is worth <b>1 full step</b>. Tap an option, then use <b>Lock In Final Answer</b>. A confirmation appears before the answer is marked.</p>
  <h3>Shout-Out + Steal</h3><p>If enabled, one wrong answer opens a single steal. The teacher chooses another team to attempt the same question.</p>
  <h3>Kings & Queens</h3><p>The whole class works together toward the 10-step castle. Correct answers add progress; a wrong answer earns no step but never removes progress already achieved.</p>
  <h3>Classroom controls</h3><p>Use Full Screen for a whiteboard/TV. Undo corrects accidental marking. Game state is saved on the device, so an accidental refresh does not wipe the scores.</p>
  <h3>PWA install</h3><p>Once hosted over HTTPS (for example GitHub Pages), use the browser’s Add to Home Screen / Install App option for a full-screen app icon experience.</p>`,[['Close','primary',closeModal]]);
}

/* Events */
view.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act,val=b.dataset.value;
  if(act==='setup'){state.screen='setup';render();}
  else if(act==='home'){state.screenBeforeHome=state.screen;state.screen='welcome';render();}
  else if(act==='resume'){state.screen=state.screenBeforeHome|| (state.question?'game':'setup');render();}
  else if(act==='help')showHelp();
  else if(act==='play'){state.playMode=val;render();}
  else if(act==='answer'){state.answerMode=val;render();}
  else if(act==='turn'){state.turnStyle=val;render();}
  else if(act==='steals'){state.steals=!state.steals;render();}
  else if(act==='team'){const id=val;if(state.active.includes(id)){if(state.active.length>2)state.active=state.active.filter(x=>x!==id);}else if(state.active.length<4)state.active.push(id);render();}
  else if(act==='source'){state.quizSource=val;render();}
  else if(act==='browse-subject'){state.browseSubject=val;render();}
  else if(act==='topic'){const sub=b.dataset.subject,top=val,key=`${sub}|||${top}`;if(state.quizSource==='single'){state.subject=sub;state.topic=top;}else{state.mixed=state.mixed.includes(key)?state.mixed.filter(x=>x!==key):[...state.mixed,key];}render();}
  else if(act==='timer'){state.timer=Number(val);render();}
  else if(act==='launch')launch();
  else if(act==='shuffle-go')runShuffle();
  else if(act==='shuffle-start')beginGame();
  else if(act==='responder'){state.responder=val;state.attempted=[];state.isSteal=false;tone('click');render();}
  else if(act==='steal-team'){state.responder=val;state.attempted.push(val);state.isSteal=true;state.phase='answer';state.selected=null;state.timerRemaining=state.timer;tone('click');react('idea','Steal attempt',`${TEAM[val].name}, this one's yours.`,1400);render();}
  else if(act==='mark')markClassic(val==='correct');
  else if(act==='hint'){state.hintUsed=true;state.selected=null;tone('click');react('think','Choices revealed','A correct answer is now worth half a step.',1600);render();}
  else if(act==='option'){state.selected=val;tone('click');render();}
  else if(act==='lock')confirmLock();
  else if(act==='next')nextQuestion();
  else if(act==='skip')skipQuestion();
  else if(act==='pass')passTurn();
  else if(act==='undo')undo();
  else if(act==='again')playAgain();
  else if(act==='setup-new'){resetGameOnly();state.screen='setup';render();}
});
$('#helpBtn').addEventListener('click',showHelp);
$('#modalClose').addEventListener('click',closeModal);$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
$('#homeBtn').addEventListener('click',()=>{if(state.screen!=='welcome'){state.screenBeforeHome=state.screen;state.screen='welcome';render();}});
$('#soundBtn').addEventListener('click',()=>{state.muted=!state.muted;$('#soundBtn').textContent=state.muted?'🔇':'🔊';save();if(!state.muted)tone('click');});
$('#fullBtn').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch(e){}});
window.addEventListener('keydown',e=>{if(state.screen!=='game'||$('#modal').hidden===false)return;if(e.key==='h'||e.key==='H'){if(state.answerMode==='classic'&&!state.hintUsed)state.hintUsed=true,render();}if(e.key==='c'||e.key==='C'){if(state.answerMode==='classic'&&!state.hintUsed)markClassic(true);}if(e.key==='x'||e.key==='X'){if(state.answerMode==='classic'&&!state.hintUsed)markClassic(false);}if(['1','2','3','4'].includes(e.key)&&(state.answerMode==='mc'||state.hintUsed)){const opt=state.question.options[Number(e.key)-1];if(opt&&!state.disabledOptions.includes(opt)){state.selected=opt;render();}}if(e.key==='Enter'&&state.selected)confirmLock();});
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
$('#soundBtn').textContent=state.muted?'🔇':'🔊';
// Start on welcome while preserving the previous screen for Resume.
if(state.screen!=='welcome'){state.screenBeforeHome=state.screen;state.screen='welcome';}
render();
})();
