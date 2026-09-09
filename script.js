const STEP=15,STORE="work-scheduler-v2";
const COLORS=["#17a9df","#18b777","#ffc21a","#ac8ee6","#f28d75","#75b95b","#e99ac2"];

let members=[
member("A","一般"),
member("B","一般"),
member("C","一般")
];

let tasks=[
task("作業1",480,2,""),
task("作業2",240,2,""),
task("作業3",120,1,"")
];

let draggedTaskId=null;

const $=id=>document.getElementById(id);
const startEl=$("workStart");
const endEl=$("workEnd");
const memberList=$("memberList");
const taskList=$("taskList");
const resultArea=$("resultArea");
const resultMessage=$("resultMessage");

setDefaultDateTimes();
load();
render();

$("addMember").onclick=()=>{
members.push(member());
save();
render();
};

$("addTask").onclick=()=>{
const newTask=task();
newTask.color=COLORS[tasks.length%COLORS.length];
tasks.push(newTask);
save();
renderTasks();
};

$("makeScheduleTop").onclick=makeSchedule;
$("makeScheduleBottom").onclick=makeSchedule;

const printButton=$("printSchedule");

if(printButton){
printButton.onclick=()=>{
if(!resultArea.querySelector(".schedule")){
toast("先に工程表を作成してください");
return;
}
window.print();
};
}

startEl.onchange=()=>{
startEl.value=normalizeDateTime(startEl.value);
save();
};

endEl.onchange=()=>{
endEl.value=normalizeDateTime(endEl.value);
save();
};

function id(){
return Date.now().toString(36)+Math.random().toString(36).slice(2,8);
}

function member(name="",skills=""){
return{
id:id(),
name,
skills,
breaks:[]
};
}

function task(name="",minutes=60,people=1,skill=""){
return{
id:id(),
name,
minutes,
start:"",
people,
skill,
before:"",
interruptible:true,
shareable:false,
color:""
};
}

function render(){
renderMembers();
renderTasks();
}

function renderMembers(){
memberList.innerHTML="";

members.forEach(currentMember=>{
const card=el("article","member-card");
const main=el("div","member-main");

main.append(
textField(
"名前",
currentMember.name,
value=>{
currentMember.name=value;
}
),
textField(
"専門（複数は読点・カンマ区切り）",
currentMember.skills,
value=>{
currentMember.skills=value;
},
"",
renderTasks
),
button(
"削除",
"delete",
()=>{
members=members.filter(item=>item.id!==currentMember.id);
save();
render();
}
)
);

const box=el("div","break-box");
const head=el("div","break-head");

head.innerHTML="<strong>休憩時間</strong>";

head.append(
button(
"＋ 休憩を追加",
"small",
()=>{
currentMember.breaks.push({
id:id(),
start:dateTimeOnWorkDate("12:00"),
end:dateTimeOnWorkDate("13:00")
});
save();
renderMembers();
}
)
);

const list=el("div","break-list");

if(!currentMember.breaks.length){
list.innerHTML='<p class="muted">休憩なし</p>';
}

currentMember.breaks.forEach(breakItem=>{
const row=el("div","break-row");

row.append(
timeInput(
breakItem.start,
value=>{
breakItem.start=value;
},
"休憩開始"
),
span("～","dash"),
timeInput(
breakItem.end,
value=>{
breakItem.end=value;
},
"休憩終了"
),
button(
"削除",
"delete",
()=>{
currentMember.breaks=currentMember.breaks.filter(
item=>item.id!==breakItem.id
);
save();
renderMembers();
}
)
);

list.append(row);
});

box.append(head,list);
card.append(main,box);
memberList.append(card);
});
}

function renderTasks(){
taskList.innerHTML="";

tasks.forEach((currentTask,index)=>{
currentTask.color=currentTask.color||COLORS[index%COLORS.length];

const card=el("article","task-card");
card.style.setProperty("--card-color",currentTask.color);

const accent=el("div","accent");
const body=el("div","task-body");
const head=el("div","card-head");

head.innerHTML=`<p>優先順位 ${index+1}</p>`;

const actions=el("div","card-actions");

const upButton=button(
"↑",
"order-button",
()=>{
moveTask(currentTask.id,-1);
}
);

const downButton=button(
"↓",
"order-button",
()=>{
moveTask(currentTask.id,1);
}
);

const handle=span("↕","drag-handle");

upButton.disabled=index===0;
downButton.disabled=index===tasks.length-1;

upButton.title="優先順位を上げる";
downButton.title="優先順位を下げる";
handle.title="ドラッグして並べ替え";
handle.draggable=true;

handle.addEventListener("dragstart",event=>{
draggedTaskId=currentTask.id;
card.classList.add("dragging");
event.dataTransfer.effectAllowed="move";
event.dataTransfer.setData("text/plain",currentTask.id);
});

handle.addEventListener("dragend",()=>{
draggedTaskId=null;

document.querySelectorAll(".task-card").forEach(item=>{
item.classList.remove("dragging","drag-over");
});
});

card.addEventListener("dragover",event=>{
event.preventDefault();

if(draggedTaskId&&draggedTaskId!==currentTask.id){
card.classList.add("drag-over");
}
});

card.addEventListener("dragleave",()=>{
card.classList.remove("drag-over");
});

card.addEventListener("drop",event=>{
event.preventDefault();
card.classList.remove("drag-over");

const sourceId=
draggedTaskId||
event.dataTransfer.getData("text/plain");

const placeAfter=
event.clientY>
card.getBoundingClientRect().top+
card.offsetHeight/2;

reorderTask(
sourceId,
currentTask.id,
placeAfter
);
});

actions.append(
upButton,
downButton,
handle,
button(
"削除",
"delete",
()=>{
const deletedId=currentTask.id;

tasks=tasks.filter(item=>item.id!==deletedId);

tasks.forEach(item=>{
if(item.before===deletedId){
item.before="";
}
});

save();
renderTasks();
}
)
);

head.append(actions);

const fields=el("div","fields");

fields.append(
textField(
"作業名",
currentTask.name,
value=>{
currentTask.name=value;
},
"wide"
),
numberField(
"所要時間（分）",
currentTask.minutes,
value=>{
currentTask.minutes=value;
}
),
optionalTime(
"開始日時（任意）",
currentTask.start,
value=>{
currentTask.start=value;
}
),
numberField(
"必要人数（最低人数）",
currentTask.people,
value=>{
currentTask.people=value;
}
),
skillField(currentTask),
beforeField(currentTask),
checkField(
"中断可能",
currentTask.interruptible,
value=>{
currentTask.interruptible=value;
}
),
checkField(
"分担可能（空き人員も参加）",
currentTask.shareable,
value=>{
currentTask.shareable=value;
}
)
);

body.append(head,fields);
card.append(accent,body);
taskList.append(card);
});
}

function textField(title,value,setValue,extraClass="",commitFunction=null){
const field=el("label",extraClass);
field.append(label(title));

const input=document.createElement("input");
input.type="text";
input.value=value;

input.oninput=()=>{
setValue(input.value);
save();
};

if(commitFunction){
input.onchange=commitFunction;
}

field.append(input);
return field;
}

function numberField(title,value,setValue){
const field=el("label");
field.append(label(title));

const input=document.createElement("input");
input.type="number";
input.min="1";
input.step="1";
input.value=value;

input.oninput=()=>{
const number=Math.max(
1,
Math.round(Number(input.value)||1)
);

setValue(number);
save();
};

field.append(input);
return field;
}

function optionalTime(title,value,setValue){
const field=el("label");
field.append(label(title));

const input=dateTextInput(
value,
setValue,
"開始日時"
);

field.append(input);
return field;
}

function timeInput(value,setValue,ariaLabel){
return dateTextInput(
value,
setValue,
ariaLabel
);
}

function dateTextInput(value,setValue,ariaLabel){
const input=document.createElement("input");

input.type="text";
input.inputMode="numeric";
input.placeholder="2026-09-03 09:00";
input.value=normalizeDateTime(value);
input.setAttribute("aria-label",ariaLabel);

input.onchange=()=>{
input.value=normalizeDateTime(input.value);
setValue(input.value);
save();
};

return input;
}

function skillField(currentTask){
const field=el("label");

field.append(
label("専門性（複数選択可）")
);

const select=document.createElement("select");

select.multiple=true;
select.className="skill-select";

const skillList=[
...new Set(
members.flatMap(currentMember=>
skills(currentMember.skills)
)
)
];

const selectedSkills=skills(currentTask.skill);

const none=document.createElement("option");
none.value="";

none.textContent=
skillList.length
?"指定なし（選択を解除）"
:"メンバーの専門を先に入力";

none.selected=!selectedSkills.length;

if(!skillList.length){
none.disabled=true;
}

select.append(none);

selectedSkills
.filter(value=>!skillList.includes(value))
.forEach(value=>{
const option=document.createElement("option");

option.value=value;
option.textContent=value+"（未登録）";
option.selected=true;

select.append(option);
});

skillList.forEach(value=>{
const option=document.createElement("option");

option.value=value;
option.textContent=value;
option.selected=selectedSkills.includes(value);

select.append(option);
});

select.size=Math.min(
Math.max(skillList.length+1,2),
5
);

select.onchange=()=>{
const selectedValues=[
...select.selectedOptions
]
.map(option=>option.value)
.filter(Boolean);

currentTask.skill=selectedValues.join("、");
none.selected=!selectedValues.length;

save();
};

field.append(select);
return field;
}

function beforeField(currentTask){
const field=el("label");

field.append(
label("前工程（任意）")
);

const select=document.createElement("select");

select.innerHTML=
'<option value="">なし</option>';

tasks
.filter(item=>item.id!==currentTask.id)
.forEach(item=>{
const option=document.createElement("option");

option.value=item.id;
option.textContent=item.name||"名称未入力";
option.selected=currentTask.before===item.id;

select.append(option);
});

select.onchange=()=>{
currentTask.before=select.value;
save();
};

field.append(select);
return field;
}

function checkField(title,value,setValue){
const field=el("label","check-field");
const text=span(title,"label");
const input=document.createElement("input");

input.type="checkbox";
input.checked=value;

input.onchange=()=>{
setValue(input.checked);
save();
};

field.append(text,input);
return field;
}

function el(tagName,className=""){
const element=document.createElement(tagName);

if(className){
element.className=className;
}

return element;
}

function span(text,className=""){
const element=el("span",className);
element.textContent=text;
return element;
}

function label(text){
return span(text);
}

function button(text,className,clickFunction){
const element=el("button",className);

element.type="button";
element.textContent=text;
element.onclick=clickFunction;

return element;
}

function moveTask(taskId,direction){
const from=tasks.findIndex(
currentTask=>currentTask.id===taskId
);

const to=from+direction;

if(
from<0||
to<0||
to>=tasks.length
){
return;
}

const[movedTask]=tasks.splice(from,1);

tasks.splice(to,0,movedTask);

save();
renderTasks();
}

function reorderTask(sourceId,targetId,placeAfter){
if(!sourceId||sourceId===targetId){
return;
}

const from=tasks.findIndex(
currentTask=>currentTask.id===sourceId
);

if(
from<0||
!tasks.some(
currentTask=>currentTask.id===targetId
)
){
return;
}

const[movedTask]=tasks.splice(from,1);

const target=tasks.findIndex(
currentTask=>currentTask.id===targetId
);

tasks.splice(
target+(placeAfter?1:0),
0,
movedTask
);

save();
renderTasks();
}

function makeSchedule(){
save();

const begin=toMin(startEl.value);
const finish=toMin(endEl.value);

const activeMembers=members.filter(
currentMember=>currentMember.name.trim()
);

const activeTasks=tasks.filter(
currentTask=>currentTask.name.trim()
);

if(
begin===null||
finish===null||
finish<=begin
){
toast(
"全体の開始・終了日時を確認してください"
);
return;
}

if(!activeMembers.length){
toast(
"メンバーを1人以上入力してください"
);
return;
}

if(!activeTasks.length){
toast(
"作業を1件以上入力してください"
);
return;
}

if((finish-begin)%STEP){
toast(
"全体の時刻は15分単位で設定してください"
);
return;
}

for(const currentMember of activeMembers){
for(const breakItem of currentMember.breaks){
const breakStart=toMin(breakItem.start);
const breakEnd=toMin(breakItem.end);

if(
breakStart===null||
breakEnd===null
){
toast(
`${currentMember.name}さんの休憩日時は「2026-09-03 12:00」の形式で入力してください`
);
return;
}

if(
breakEnd<=breakStart||
breakStart<begin||
breakEnd>finish
){
toast(
`${currentMember.name}さんの休憩日時を全体時間内で確認してください`
);
return;
}

if(
(breakStart-begin)%STEP||
(breakEnd-begin)%STEP
){
toast(
`${currentMember.name}さんの休憩を15分単位で設定してください`
);
return;
}
}
}

for(const currentTask of activeTasks){
if(!currentTask.start){
continue;
}

const taskStart=toMin(currentTask.start);

if(taskStart===null){
toast(
`${currentTask.name}の開始日時は「2026-09-03 09:00」の形式で入力してください`
);
return;
}

if((taskStart-begin)%STEP){
toast(
`${currentTask.name}の開始時刻は15分単位で設定してください`
);
return;
}
}

const result=createSchedule(
activeTasks,
activeMembers,
begin,
finish
);

draw(
result,
activeMembers,
begin
);

$("resultSection").scrollIntoView({
behavior:"smooth",
block:"start"
});
}

function createSchedule(activeTasks,activeMembers,begin,finish){
const slotCount=(finish-begin)/STEP;

const cells=Object.fromEntries(
activeMembers.map(currentMember=>[
currentMember.id,
Array(slotCount).fill(null)
])
);

const completed={};
const failed=[];
const visiting=new Set();

activeMembers.forEach(currentMember=>{
currentMember.breaks.forEach(breakItem=>{
const startSlot=
(toMin(breakItem.start)-begin)/STEP;

const endSlot=
(toMin(breakItem.end)-begin)/STEP;

for(
let slot=startSlot;
slot<endSlot;
slot++
){
cells[currentMember.id][slot]={
type:"break"
};
}
});
});

const tasksById=Object.fromEntries(
activeTasks.map(currentTask=>[
currentTask.id,
currentTask
])
);

function place(currentTask,deadline=slotCount){
if(completed[currentTask.id]){
return completed[currentTask.id];
}

if(visiting.has(currentTask.id)){
addFailure(
currentTask,
"前工程が循環しています"
);
return null;
}

visiting.add(currentTask.id);

let earliest=0;

if(currentTask.before){
const previousTask=tasksById[currentTask.before];

if(!previousTask){
addFailure(
currentTask,
"前工程が見つかりません"
);

visiting.delete(currentTask.id);
return null;
}

const previousDeadline=currentTask.start
?(toMin(currentTask.start)-begin)/STEP
:deadline;

const previousResult=place(
previousTask,
previousDeadline
);

if(!previousResult){
addFailure(
currentTask,
"前工程を配置できません"
);

visiting.delete(currentTask.id);
return null;
}

earliest=previousResult.end;
}

const requiredSkills=skills(currentTask.skill);

const missingSkills=requiredSkills.filter(
requiredSkill=>{
return !activeMembers.some(
currentMember=>{
return skills(
currentMember.skills
).includes(requiredSkill);
}
);
}
);

if(missingSkills.length){
addFailure(
currentTask,
`専門「${missingSkills.join("、")}」を持つメンバーがいません`
);

visiting.delete(currentTask.id);
return null;
}

const eligibleMembers=activeMembers;

const fixedSlot=currentTask.start
?(toMin(currentTask.start)-begin)/STEP
:null;

if(
fixedSlot!==null&&
(
fixedSlot<0||
fixedSlot>=slotCount
)
){
addFailure(
currentTask,
"開始日時が全体の時間外です"
);

visiting.delete(currentTask.id);
return null;
}

if(
fixedSlot!==null&&
fixedSlot<earliest
){
addFailure(
currentTask,
"開始日時が前工程の完了より前です"
);

visiting.delete(currentTask.id);
return null;
}

const plan=currentTask.shareable
?planShareable(
currentTask,
eligibleMembers,
cells,
fixedSlot??earliest,
deadline,
fixedSlot!==null
)
:planTogether(
currentTask,
eligibleMembers,
cells,
fixedSlot??earliest,
deadline,
fixedSlot!==null
);

if(!plan){
addFailure(
currentTask,
"必要な人数、専門性、または時間枠を確保できません"
);

visiting.delete(currentTask.id);
return null;
}

plan.parts.forEach(part=>{
for(
let slot=part.start;
slot<part.end;
slot++
){
cells[part.memberId][slot]={
type:"task",
task:currentTask
};
}
});

completed[currentTask.id]={
...plan,
task:currentTask
};

visiting.delete(currentTask.id);

return completed[currentTask.id];
}

function addFailure(currentTask,reason){
const exists=failed.some(
item=>item.task.id===currentTask.id
);

if(!exists){
failed.push({
task:currentTask,
reason
});
}
}

activeTasks
.filter(currentTask=>currentTask.start)
.sort(
(first,second)=>
toMin(first.start)-toMin(second.start)
)
.forEach(currentTask=>{
place(currentTask);
});

activeTasks
.filter(currentTask=>!currentTask.start)
.forEach(currentTask=>{
place(currentTask);
});

return{
cells,
done:Object.values(completed),
failed,
slotCount
};
}

function planTogether(currentTask,eligibleMembers,cells,fromSlot,deadline,fixedStart){
const requiredPeople=Math.max(
1,
Number(currentTask.people)
);

const requiredSlots=Math.ceil(
Number(currentTask.minutes)/STEP
);

if(eligibleMembers.length<requiredPeople){
return null;
}

const groups=combinations(
eligibleMembers,
requiredPeople
).filter(group=>{
return coversSkills(
group,
currentTask.skill
);
});

for(const group of groups){
const possibleStarts=fixedStart
?[fromSlot]
:Array.from(
{
length:Math.max(
0,
deadline-fromSlot
)
},
(_,index)=>fromSlot+index
);

for(const startSlot of possibleStarts){
let usedSlots=[];

if(currentTask.interruptible){
for(
let slot=startSlot;
slot<deadline&&
usedSlots.length<requiredSlots;
slot++
){
const allFree=group.every(
currentMember=>
!cells[currentMember.id][slot]
);

if(allFree){
usedSlots.push(slot);
}
}
}else{
usedSlots=Array.from(
{length:requiredSlots},
(_,index)=>startSlot+index
);

const outside=
usedSlots.at(-1)>=deadline;

const occupied=usedSlots.some(
slot=>group.some(
currentMember=>
cells[currentMember.id][slot]
)
);

if(outside||occupied){
continue;
}
}

if(
usedSlots.length<requiredSlots||
usedSlots[0]!==startSlot
){
continue;
}

const parts=[];

group.forEach(currentMember=>{
ranges(usedSlots).forEach(
currentRange=>{
parts.push({
memberId:currentMember.id,
...currentRange
});
}
);
});

return{
parts,
start:startSlot,
end:usedSlots.at(-1)+1
};
}
}

return null;
}

function planShareable(currentTask,eligibleMembers,cells,fromSlot,deadline,fixedStart){
const minimumPeople=Math.max(
1,
Number(currentTask.people)
);

const requiredWork=Math.ceil(
Number(currentTask.minutes)/STEP
)*minimumPeople;

const possibleStarts=fixedStart
?[fromSlot]
:Array.from(
{
length:Math.max(
0,
deadline-fromSlot
)
},
(_,index)=>fromSlot+index
);

if(eligibleMembers.length<minimumPeople){
return null;
}

for(const startSlot of possibleStarts){
let workLeft=requiredWork;
const used={};
let started=false;
let hadGap=false;
let lastSlot=startSlot-1;
let actualStart=null;

for(
let slot=startSlot;
slot<deadline&&workLeft>0;
slot++
){
const availableMembers=eligibleMembers.filter(
currentMember=>
!cells[currentMember.id][slot]
);

const canWork=
availableMembers.length>=minimumPeople&&
coversSkills(
availableMembers,
currentTask.skill
);

if(!canWork){
if(
slot===startSlot&&
fixedStart
){
break;
}

if(started){
hadGap=true;
}

if(
!currentTask.interruptible&&
started
){
break;
}

continue;
}

if(
slot===startSlot||
started||
!fixedStart
){
if(
!currentTask.interruptible&&
hadGap
){
break;
}

if(!started){
actualStart=slot;
}

const desiredPeople=Math.min(
availableMembers.length,
Math.max(
minimumPeople,
workLeft
)
);

const workers=chooseWorkers(
availableMembers,
desiredPeople,
currentTask.skill
);

if(!workers){
if(
fixedStart&&
slot===startSlot
){
break;
}

continue;
}

started=true;

workers.forEach(currentMember=>{
if(!used[currentMember.id]){
used[currentMember.id]=[];
}

used[currentMember.id].push(slot);
});

workLeft-=workers.length;
lastSlot=slot;
}
}

if(
workLeft<=0&&
started
){
const parts=[];

Object.entries(used).forEach(
([memberId,usedSlots])=>{
ranges(usedSlots).forEach(
currentRange=>{
parts.push({
memberId,
...currentRange
});
}
);
}
);

return{
parts,
start:actualStart,
end:lastSlot+1
};
}
}

return null;
}

function ranges(slots){
const output=[];

if(!slots.length){
return output;
}

let rangeStart=slots[0];
let rangeEnd=rangeStart+1;

for(
let index=1;
index<slots.length;
index++
){
if(slots[index]===rangeEnd){
rangeEnd++;
}else{
output.push({
start:rangeStart,
end:rangeEnd
});

rangeStart=slots[index];
rangeEnd=rangeStart+1;
}
}

output.push({
start:rangeStart,
end:rangeEnd
});

return output;
}

function combinations(items,count){
const output=[];

function select(startIndex,selectedItems){
if(selectedItems.length===count){
output.push([...selectedItems]);
return;
}

for(
let index=startIndex;
index<=
items.length-
(count-selectedItems.length);
index++
){
selectedItems.push(items[index]);
select(index+1,selectedItems);
selectedItems.pop();
}
}

select(0,[]);

return output;
}

function skills(text){
return String(text||"")
.split(/[,、，]/)
.map(value=>value.trim())
.filter(Boolean);
}

function coversSkills(team,requiredText){
const requiredSkills=skills(requiredText);

return requiredSkills.every(
requiredSkill=>{
return team.some(
currentMember=>{
return skills(
currentMember.skills
).includes(requiredSkill);
}
);
}
);
}

function chooseWorkers(availableMembers,desiredPeople,requiredText){
for(
let count=Math.max(1,desiredPeople);
count<=availableMembers.length;
count++
){
const selectedTeam=combinations(
availableMembers,
count
).find(group=>{
return coversSkills(
group,
requiredText
);
});

if(selectedTeam){
return selectedTeam;
}
}

return null;
}

function draw(result,activeMembers,begin){
resultArea.innerHTML="";

resultMessage.textContent=
`${result.done.length}件を配置しました`;

const usedTasks=[
...new Map(
result.done.map(item=>[
item.task.id,
item.task
])
).values()
];

if(usedTasks.length){
const legend=el("div","legend");

usedTasks.forEach(currentTask=>{
const item=el("div","legend-item");
const color=el("span","swatch");

color.style.background=currentTask.color;

item.append(
color,
document.createTextNode(
currentTask.name
)
);

legend.append(item);
});

resultArea.append(legend);
}

const table=el("div","schedule");

table.style.setProperty(
"--slots",
result.slotCount
);

const header=el("div","timeline-row");
const corner=el("div","name-cell");

corner.textContent="作業者名";
header.append(corner);

for(
let slot=0;
slot<result.slotCount;
slot+=4
){
const timeCell=el(
"div",
"time-cell hour-line"
);

const columnSpan=Math.min(
4,
result.slotCount-slot
);

timeCell.style.gridColumn=
`${slot+2} / span ${columnSpan}`;

timeCell.textContent=clock(
begin+slot*STEP
);

header.append(timeCell);
}

table.append(header);

activeMembers.forEach(currentMember=>{
const row=el("div","timeline-row");
const name=el("div","name-cell");

name.textContent=currentMember.name;
row.append(name);

for(
let slot=0;
slot<result.slotCount;
slot++
){
let lineClass="";

if(slot%4===0){
lineClass="hour-line";
}else if(slot%2===0){
lineClass="half-line";
}

const grid=el(
"div",
"grid-cell "+lineClass
);

grid.style.gridColumn=slot+2;
row.append(grid);
}

let slot=0;

while(slot<result.slotCount){
const cell=
result.cells[currentMember.id][slot];

if(!cell){
slot++;
continue;
}

let endSlot=slot+1;

while(
endSlot<result.slotCount&&
sameCell(
cell,
result.cells[
currentMember.id
][endSlot]
)
){
endSlot++;
}

const bar=el(
"div",
cell.type==="break"
?"break-bar"
:"bar"
);

bar.style.gridColumn=
`${slot+2} / ${endSlot+2}`;

if(cell.type==="break"){
bar.textContent="休憩";
}else{
bar.textContent=cell.task.name;

bar.style.setProperty(
"--bar-color",
cell.task.color
);
}

row.append(bar);
slot=endSlot;
}

table.append(row);
});

resultArea.append(table);

if(result.failed.length){
const box=el(
"section",
"unplaced"
);

const failureList=result.failed
.map(item=>{
return(
"<li><strong>"+
escapeHtml(item.task.name)+
"</strong>："+
escapeHtml(item.reason)+
"</li>"
);
})
.join("");

box.innerHTML=
"<h3>配置できなかった作業</h3>"+
"<ul>"+
failureList+
"</ul>";

resultArea.append(box);
}
}

function sameCell(first,second){
return(
first&&
second&&
first.type===second.type&&
(
first.type==="break"||
first.task.id===second.task.id
)
);
}

function parseDateTime(value){
const match=String(value||"")
.trim()
.match(
/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})$/
);

if(!match){
return null;
}

const year=Number(match[1]);
const month=Number(match[2]);
const day=Number(match[3]);
const hours=Number(match[4]);
const minutes=Number(match[5]);

const date=new Date(
year,
month-1,
day,
hours,
minutes
);

const valid=
date.getFullYear()===year&&
date.getMonth()===month-1&&
date.getDate()===day&&
date.getHours()===hours&&
date.getMinutes()===minutes;

return valid?date:null;
}

function toMin(value){
const date=parseDateTime(value);

if(!date){
return null;
}

return Math.floor(
date.getTime()/60000
);
}

function clock(totalMinutes){
const date=new Date(
totalMinutes*60000
);

const month=String(
date.getMonth()+1
).padStart(2,"0");

const day=String(
date.getDate()
).padStart(2,"0");

const hours=String(
date.getHours()
).padStart(2,"0");

const minutes=String(
date.getMinutes()
).padStart(2,"0");

return(
month+
"/"+
day+
"\n"+
hours+
":"+
minutes
);
}

function localDateTime(date){
const year=date.getFullYear();

const month=String(
date.getMonth()+1
).padStart(2,"0");

const day=String(
date.getDate()
).padStart(2,"0");

const hours=String(
date.getHours()
).padStart(2,"0");

const minutes=String(
date.getMinutes()
).padStart(2,"0");

return(
year+
"-"+
month+
"-"+
day+
" "+
hours+
":"+
minutes
);
}

function setDefaultDateTimes(){
const now=new Date();

const start=new Date(
now.getFullYear(),
now.getMonth(),
now.getDate(),
7,
0
);

const end=new Date(
now.getFullYear(),
now.getMonth(),
now.getDate(),
20,
0
);

startEl.value=localDateTime(start);
endEl.value=localDateTime(end);
}

function dateTimeOnWorkDate(time){
const base=
parseDateTime(startEl.value)||
new Date();

const[hours,minutes]=
time.split(":").map(Number);

return localDateTime(
new Date(
base.getFullYear(),
base.getMonth(),
base.getDate(),
hours,
minutes
)
);
}

function normalizeDateTime(value){
if(/^\d{2}:\d{2}$/.test(value||"")){
return dateTimeOnWorkDate(value);
}

const date=parseDateTime(value);

if(date){
return localDateTime(date);
}

return String(value||"").trim();
}

function escapeHtml(value){
const element=
document.createElement("div");

element.textContent=String(value);

return element.innerHTML;
}

function toast(message){
const element=$("toast");

element.textContent=message;
element.classList.add("show");

clearTimeout(toast.timer);

toast.timer=setTimeout(()=>{
element.classList.remove("show");
},2600);
}

function save(){
localStorage.setItem(
STORE,
JSON.stringify({
start:startEl.value,
end:endEl.value,
members,
tasks
})
);
}

function load(){
try{
const saved=JSON.parse(
localStorage.getItem(STORE)
);

if(!saved){
return;
}

if(saved.start){
startEl.value=
normalizeDateTime(saved.start);
}

if(saved.end){
endEl.value=
normalizeDateTime(saved.end);
}

if(Array.isArray(saved.members)){
members=saved.members.map(
savedMember=>{
const savedBreaks=
Array.isArray(
savedMember.breaks
)
?savedMember.breaks
:[];

return{
...member(),
...savedMember,
breaks:savedBreaks.map(
breakItem=>{
return{
...breakItem,
start:normalizeDateTime(
breakItem.start
),
end:normalizeDateTime(
breakItem.end
)
};
}
)
};
}
);
}

if(Array.isArray(saved.tasks)){
tasks=saved.tasks.map(
(savedTask,index)=>{
return{
...task(),
...savedTask,
start:normalizeDateTime(
savedTask.start
),
color:
savedTask.color||
COLORS[index%COLORS.length]
};
}
);
}
}catch(error){
console.warn(
"保存データを読み込めませんでした",
error
);
}
}