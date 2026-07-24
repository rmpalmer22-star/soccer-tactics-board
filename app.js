import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// ---------- DOM refs ----------
const svgNS = "http://www.w3.org/2000/svg";
const svg = document.getElementById('pitch');
const ownG = document.getElementById('own');
const oppG = document.getElementById('opp');
const ballG = document.getElementById('ball');
const lanesG = document.getElementById('lanes');
const laneNote = document.getElementById('laneNote');
const syncStatus = document.getElementById('syncStatus');

const PXY = 7.9;
const LANE_THRESH = 5.5 * PXY;

// ---------- Default formation ----------
const ownInitial = [
  {id:"gk1", x:340, y:920, l:"GK", cls:"c-blue"},
  {id:"lb", x:160, y:800, l:"LB", cls:"c-blue"},
  {id:"cb1", x:280, y:800, l:"CB", cls:"c-blue"},
  {id:"cb2", x:400, y:800, l:"CB", cls:"c-blue"},
  {id:"rb", x:520, y:800, l:"RB", cls:"c-blue"},
  {id:"lm", x:180, y:680, l:"LM", cls:"c-blue"},
  {id:"cm1", x:300, y:680, l:"CM", cls:"c-blue"},
  {id:"cm2", x:380, y:680, l:"CM", cls:"c-blue"},
  {id:"rm", x:500, y:680, l:"RM", cls:"c-blue"},
  {id:"st1", x:280, y:580, l:"ST", cls:"c-blue"},
  {id:"st2", x:400, y:580, l:"ST", cls:"c-blue"}
];
const oppInitial = [
  {id:"gk2", x:340, y:80, l:"GK", cls:"c-coral"},
  {id:"olb", x:160, y:200, l:"LB", cls:"c-coral"},
  {id:"ocb1", x:280, y:200, l:"CB", cls:"c-coral"},
  {id:"ocb2", x:400, y:200, l:"CB", cls:"c-coral"},
  {id:"orb", x:520, y:200, l:"RB", cls:"c-coral"},
  {id:"olcm", x:250, y:340, l:"CM", cls:"c-coral"},
  {id:"odm", x:340, y:320, l:"DM", cls:"c-coral"},
  {id:"orcm", x:430, y:340, l:"CM", cls:"c-coral"},
  {id:"olw", x:180, y:460, l:"LW", cls:"c-coral"},
  {id:"ost", x:340, y:440, l:"ST", cls:"c-coral"},
  {id:"orw", x:500, y:460, l:"RW", cls:"c-coral"}
];
const ballInitial = {x:340, y:500};

let ownState = JSON.parse(JSON.stringify(ownInitial));
let oppState = JSON.parse(JSON.stringify(oppInitial));
let ball = {...ballInitial};
let dragId = null;
let isDragging = false;

// ---------- Firestore sync ----------
const boardRef = doc(db, "boards", "main");
let seededOnce = false;

function setSyncStatus(text) { if (syncStatus) syncStatus.textContent = text; }

function pushState() {
  setSyncStatus("🟡 Saving…");
  setDoc(boardRef, { own: ownState, opp: oppState, ball: ball, updatedAt: Date.now() })
    .then(() => setSyncStatus("🟢 Live — synced " + new Date().toLocaleTimeString()))
    .catch((err) => {
      console.error("Firestore write failed:", err);
      setSyncStatus("🔴 Sync failed — check Firestore rules in the Firebase console");
    });
}

onSnapshot(boardRef, (snap) => {
  if (!snap.exists()) {
    if (!seededOnce) { seededOnce = true; pushState(); }
    return;
  }
  const data = snap.data();
  if (!isDragging && data.own && data.opp && data.ball) {
    ownState = data.own;
    oppState = data.opp;
    ball = data.ball;
    renderFull();
  }
  seededOnce = true;
  setSyncStatus("🟢 Live — synced " + new Date().toLocaleTimeString());
}, (err) => {
  console.error("Firestore listen failed:", err);
  setSyncStatus("🔴 Connection error — check Firestore rules/config");
});

// ---------- Geometry helpers ----------
function svgPoint(evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function pointSegDist(px,py,x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1;
  const lenSq = dx*dx+dy*dy;
  let t = lenSq===0 ? 0 : ((px-x1)*dx+(py-y1)*dy)/lenSq;
  t = clamp(t,0,1);
  const cx = x1+t*dx, cy = y1+t*dy;
  return {dist: Math.hypot(px-cx, py-cy), t};
}

// ---------- Passing lanes ----------
function updateLanes() {
  lanesG.innerHTML = "";
  let openCount = 0, blockedCount = 0;
  oppState.forEach(opp => {
    let blocked = false, blockPoint = null, minDist = Infinity;
    ownState.forEach(own => {
      if (own.id === "gk1") return;
      const r = pointSegDist(own.x, own.y, ball.x, ball.y, opp.x, opp.y);
      if (r.t > 0.12 && r.t < 0.92 && r.dist < LANE_THRESH && r.dist < minDist) {
        minDist = r.dist; blocked = true; blockPoint = {x: own.x, y: own.y};
      }
    });
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', ball.x); line.setAttribute('y1', ball.y);
    line.setAttribute('x2', opp.x); line.setAttribute('y2', opp.y);
    if (blocked) {
      blockedCount++;
      line.setAttribute('stroke', '#8a8f88');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '3 4');
      line.setAttribute('opacity', '0.45');
    } else {
      openCount++;
      line.setAttribute('stroke', '#E24B4A');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('opacity', '0.75');
    }
    lanesG.appendChild(line);
    if (blocked) {
      const mark = document.createElementNS(svgNS, 'circle');
      mark.setAttribute('cx', blockPoint.x); mark.setAttribute('cy', blockPoint.y);
      mark.setAttribute('r', 21);
      mark.setAttribute('fill', 'none');
      mark.setAttribute('stroke', '#8a8f88');
      mark.setAttribute('stroke-width', '1');
      mark.setAttribute('stroke-dasharray', '2 3');
      mark.setAttribute('opacity', '0.55');
      lanesG.appendChild(mark);
    }
  });
  laneNote.innerHTML = openCount + " lane" + (openCount===1?"":"s") + " open, " + blockedCount + " cut off. A lane is cut off when one of your players sits within about 5 yards of the direct line between the ball and that opponent.";
}

// ---------- Rendering + drag handling ----------
function renderGroup(container, arr) {
  container.innerHTML = "";
  arr.forEach(p => {
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("class", p.cls);
    g.style.cursor = "grab";

    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("cx", p.x); c.setAttribute("cy", p.y);
    c.setAttribute("r", p.r || 15);
    c.setAttribute("stroke-width", "1.5");
    g.appendChild(c);

    if (p.l) {
      const t = document.createElementNS(svgNS, "text");
      t.setAttribute("x", p.x); t.setAttribute("y", p.y);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "central");
      t.setAttribute("pointer-events", "none");
      t.textContent = p.l;
      g.appendChild(t);
    }

    g.addEventListener("pointerdown", (e) => {
      dragId = p.id;
      isDragging = true;
      g.setPointerCapture(e.pointerId);
      g.style.cursor = "grabbing";
      e.preventDefault();
    });
    g.addEventListener("pointermove", (e) => {
      if (dragId !== p.id) return;
      const pt = svgPoint(e);
      p.x = clamp(pt.x, 60, 620);
      p.y = clamp(pt.y, 60, 940);
      c.setAttribute("cx", p.x); c.setAttribute("cy", p.y);
      const txt = g.querySelector("text");
      if (txt) { txt.setAttribute("x", p.x); txt.setAttribute("y", p.y); }
      updateLanes();
    });
    g.addEventListener("pointerup", () => {
      dragId = null; isDragging = false; g.style.cursor = "grab";
      pushState();
    });
    g.addEventListener("pointercancel", () => { dragId = null; isDragging = false; g.style.cursor = "grab"; });

    container.appendChild(g);
  });
}

function wireBall() {
  ballG.innerHTML = "";
  const g = document.createElementNS(svgNS, "g");
  g.setAttribute("class", "c-amber");
  g.style.cursor = "grab";
  const c = document.createElementNS(svgNS, "circle");
  c.setAttribute("cx", ball.x); c.setAttribute("cy", ball.y);
  c.setAttribute("r", 9);
  c.setAttribute("stroke-width", "1.5");
  g.appendChild(c);

  g.addEventListener("pointerdown", (e) => {
    dragId = "ball";
    isDragging = true;
    g.setPointerCapture(e.pointerId);
    g.style.cursor = "grabbing";
    e.preventDefault();
  });
  g.addEventListener("pointermove", (e) => {
    if (dragId !== "ball") return;
    const pt = svgPoint(e);
    ball.x = clamp(pt.x, 60, 620);
    ball.y = clamp(pt.y, 60, 940);
    c.setAttribute("cx", ball.x); c.setAttribute("cy", ball.y);
    updateLanes();
  });
  g.addEventListener("pointerup", () => {
    dragId = null; isDragging = false; g.style.cursor = "grab";
    pushState();
  });
  g.addEventListener("pointercancel", () => { dragId = null; isDragging = false; g.style.cursor = "grab"; });

  ballG.appendChild(g);
}

function renderFull() {
  renderGroup(oppG, oppState);
  renderGroup(ownG, ownState);
  wireBall();
  updateLanes();
}

document.getElementById('resetBtn').addEventListener('click', () => {
  ownState = JSON.parse(JSON.stringify(ownInitial));
  oppState = JSON.parse(JSON.stringify(oppInitial));
  ball = {...ballInitial};
  renderFull();
  pushState();
});

// Initial paint (will be immediately overwritten by onSnapshot once Firestore responds)
renderFull();
