import { useState, useCallback, useEffect, useRef } from “react”;

// ─── Tile Data ───
const SUITS = [
{ key: “wan”, cn: “萬”, en: “Characters”, color: “#c0392b” },
{ key: “tong”, cn: “筒”, en: “Dots”, color: “#2874a6” },
{ key: “tiao”, cn: “條”, en: “Bamboo”, color: “#1e8449” },
];
const RANKS = [
{ n: 1, cn: “一” }, { n: 2, cn: “二” }, { n: 3, cn: “三” },
{ n: 4, cn: “四” }, { n: 5, cn: “五” }, { n: 6, cn: “六” },
{ n: 7, cn: “七” }, { n: 8, cn: “八” }, { n: 9, cn: “九” },
];
const WINDS = [
{ key: “east”, cn: “東”, en: “East”, abbr: “E” },
{ key: “south”, cn: “南”, en: “South”, abbr: “S” },
{ key: “west”, cn: “西”, en: “West”, abbr: “W” },
{ key: “north”, cn: “北”, en: “North”, abbr: “N” },
];
const DRAGONS = [
{ key: “red”, cn: “中”, en: “Red”, color: “#c0392b”, abbr: “Red” },
{ key: “green”, cn: “發”, en: “Green”, color: “#1e8449”, abbr: “Grn” },
{ key: “white”, cn: “白”, en: “White”, color: “#555”, abbr: “Wht” },
];

function buildDeck() {
const tiles = [];
let id = 0;
for (const suit of SUITS) {
for (const rank of RANKS) {
for (let c = 0; c < 4; c++) {
tiles.push({ id: id++, type: “suit”, suit: suit.key, rank: rank.n,
cn: `${rank.cn}${suit.cn}`, en: `${rank.n} ${suit.en}`, color: suit.color });
}
}
}
for (const w of WINDS) {
for (let c = 0; c < 4; c++) {
tiles.push({ id: id++, type: “wind”, suit: “wind”, rank: w.key,
cn: w.cn, en: `${w.en} Wind`, color: “#5b2c6f”, abbr: w.abbr });
}
}
for (const d of DRAGONS) {
for (let c = 0; c < 4; c++) {
tiles.push({ id: id++, type: “dragon”, suit: “dragon”, rank: d.key,
cn: d.cn, en: `${d.en} Dragon`, color: d.color, abbr: d.abbr });
}
}
return tiles;
}

function shuffle(a) { const b=[…a]; for(let i=b.length-1;i>0;i–){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }

function sortHand(hand) {
const so = { wan: 0, tong: 1, tiao: 2, wind: 3, dragon: 4 };
const wo = { east: 0, south: 1, west: 2, north: 3 };
const dr = { red: 0, green: 1, white: 2 };
return […hand].sort((a, b) => {
if (so[a.suit] !== so[b.suit]) return so[a.suit] - so[b.suit];
if (a.suit === “wind”) return (wo[a.rank]||0) - (wo[b.rank]||0);
if (a.suit === “dragon”) return (dr[a.rank]||0) - (dr[b.rank]||0);
return a.rank - b.rank;
});
}

function botDiscard(hand) {
const counts = {};
hand.forEach(t => { const k=`${t.suit}-${t.rank}`; counts[k]=(counts[k]||0)+1; });
const isolated = hand.filter(t => counts[`${t.suit}-${t.rank}`] === 1);
const hi = isolated.filter(t => t.type !== “suit”);
if (hi.length) return hi[Math.floor(Math.random()*hi.length)];
if (isolated.length) return isolated[Math.floor(Math.random()*isolated.length)];
return hand[Math.floor(Math.random()*hand.length)];
}

function checkWin(hand, melds) {
// Total tiles should be 14: hand tiles + (3 per meld, 4 per kong)
const meldCount = melds ? melds.length : 0;
const meldTiles = melds ? melds.reduce((sum,m)=>sum+(m.type===“Kong”?4:3),0) : 0;
const total = hand.length + meldTiles;

// With melds, remaining hand must form (4 - meldCount) sets + 1 pair
// Special case: 4 melds exposed, hand should be 2 tiles (just a pair)
const setsNeeded = 4 - meldCount;

// Hand size should be setsNeeded*3 + 2 (for the pair)
// But with kong it’s setsNeeded*3 + 2, and kong melds took 4 tiles
const expectedHandSize = setsNeeded * 3 + 2;
if(hand.length !== expectedHandSize) return false;

const freq = {};
hand.forEach(t => { const k=`${t.suit}-${t.rank}`; freq[k]=(freq[k]||0)+1; });
return tryWin({…freq});
}
function tryWin(freq) {
const keys = Object.keys(freq).filter(k=>freq[k]>0);
if (!keys.length) return true;
for (const k of keys) {
if (freq[k]>=2) { const f={…freq}; f[k]-=2; if(trySets(f)) return true; }
}
return false;
}
function trySets(freq) {
const keys = Object.keys(freq).filter(k=>freq[k]>0);
if (!keys.length) return true;
const k = keys[0];
if (freq[k]>=3) { const f={…freq}; f[k]-=3; if(trySets(f)) return true; }
const [suit,rs] = k.split(”-”); const rank=parseInt(rs);
if (!isNaN(rank) && [“wan”,“tong”,“tiao”].includes(suit)) {
const k2=`${suit}-${rank+1}`, k3=`${suit}-${rank+2}`;
if ((freq[k2]||0)>=1 && (freq[k3]||0)>=1) {
const f={…freq}; f[k]-=1; f[k2]-=1; f[k3]-=1;
if(trySets(f)) return true;
}
}
return false;
}

// Check what calls the player can make on a discarded tile
function getCallOptions(hand, discardedTile, melds) {
const options = [];
const tKey = `${discardedTile.suit}-${discardedTile.rank}`;
const counts = {};
hand.forEach(t => { const k=`${t.suit}-${t.rank}`; counts[k]=(counts[k]||0)+1; });

if ((counts[tKey]||0) >= 2) options.push(“pung”);
if ((counts[tKey]||0) >= 3) options.push(“kong”);
if (discardedTile.type === “suit”) {
const r = discardedTile.rank;
const s = discardedTile.suit;
if ((counts[`${s}-${r-2}`]||0)>=1 && (counts[`${s}-${r-1}`]||0)>=1) options.push(“chow”);
if ((counts[`${s}-${r-1}`]||0)>=1 && (counts[`${s}-${r+1}`]||0)>=1) { if(!options.includes(“chow”)) options.push(“chow”); }
if ((counts[`${s}-${r+1}`]||0)>=1 && (counts[`${s}-${r+2}`]||0)>=1) { if(!options.includes(“chow”)) options.push(“chow”); }
}
// Win check — account for exposed melds
const testHand = […hand, discardedTile];
if (checkWin(testHand, melds)) options.push(“win”);

return options;
}

// For chow: find which sequences are possible and pick tiles
function getChowCombos(hand, discardedTile) {
if (discardedTile.type !== “suit”) return [];
const r = discardedTile.rank;
const s = discardedTile.suit;
const combos = [];
const findTile = (suit, rank) => hand.find(t => t.suit===suit && t.rank===rank);

// r-2, r-1
if (r >= 3) { const a=findTile(s,r-2), b=findTile(s,r-1); if(a&&b) combos.push([a,b]); }
// r-1, r+1
if (r >= 2 && r <= 8) { const a=findTile(s,r-1), b=findTile(s,r+1); if(a&&b) combos.push([a,b]); }
// r+1, r+2
if (r <= 7) { const a=findTile(s,r+1), b=findTile(s,r+2); if(a&&b) combos.push([a,b]); }
return combos;
}

// ─── Strategy Hint Engine ───

function analyzeTile(tile, hand, melds) {
// Count OTHER tiles in hand (excluding copies of THIS tile for adjacency)
const counts = {};
hand.forEach(t => { const k=`${t.suit}-${t.rank}`; counts[k]=(counts[k]||0)+1; });
const tKey = `${tile.suit}-${tile.rank}`;
const count = counts[tKey]||0;

let value = 0;

// Pairs and triplets are very valuable
if(count>=3) { value+=40; }
else if(count>=2) { value+=25; }

// Check adjacency for suit tiles (sequence/chow potential)
if(tile.type===“suit”) {
const s=tile.suit, r=tile.rank;
const has = (rank)=> rank>=1 && rank<=9 && (counts[`${s}-${rank}`]||0)>0;

```
// Complete sequences (3 in a row) — very valuable
if(has(r-2)&&has(r-1)) value+=20; // tile completes X, X+1, THIS
if(has(r-1)&&has(r+1)) value+=20; // tile is middle of sequence
if(has(r+1)&&has(r+2)) value+=20; // tile starts THIS, X+1, X+2

// Partial sequences (2 in a row, one draw away from a chow) — moderately valuable
let hasNeighbor = false;
if(has(r-1)) { value+=10; hasNeighbor=true; } // adjacent below
if(has(r+1)) { value+=10; hasNeighbor=true; } // adjacent above
// Gap sequences (e.g., have 3 and 5, tile is either — one tile fills the gap)
if(has(r-2)&&!has(r-1)) { value+=5; hasNeighbor=true; } // gap below
if(has(r+2)&&!has(r+1)) { value+=5; hasNeighbor=true; } // gap above

// Edge tiles (1,9) are less flexible for sequences
if(r===1||r===9) value-=3;
// Middle tiles (4,5,6) participate in more sequences
if(r>=4&&r<=6) value+=3;

// Truly isolated suit tile — no pairs, no neighbors, no gaps
if(count===1 && !hasNeighbor) value-=8;
```

}

// Honor tiles
if(tile.type===“wind”||tile.type===“dragon”) {
if(count===1) value-=8; // isolated honor — can only become pung, hard without draws
if(tile.type===“dragon”&&count>=2) value+=15; // dragon pairs have high fan potential
if(tile.type===“wind”&&count>=2) value+=10; // wind pairs useful
}

return { tile, value, count };
}

function getDiscardHint(hand, melds) {
if(!hand.length) return null;
const analyses = hand.map(t=>analyzeTile(t, hand, melds));
// Deduplicate: if multiple copies of same tile, only show once (lowest value instance)
const seen = {};
const unique = analyses.filter(a=>{
const k=`${a.tile.suit}-${a.tile.rank}`;
if(seen[k]) return false;
seen[k]=true;
return true;
});
unique.sort((a,b)=>a.value-b.value);
const worst = unique[0];
const best = unique[unique.length-1];

const tileName = (t) => t.en;
let hint = `Consider discarding ${tileName(worst.tile)}`;

// Explain why
if(worst.tile.type===“wind”||worst.tile.type===“dragon”) {
if(worst.count===1) {
hint += ` — isolated honor tile, no pair to build toward a pung.`;
} else {
hint += ` — least useful tile in your hand.`;
}
} else if(worst.tile.type===“suit”) {
const s=worst.tile.suit, r=worst.tile.rank;
const has=(rank)=>rank>=1&&rank<=9&&hand.some(t=>t.suit===s&&t.rank===rank&&t.id!==worst.tile.id);
const hasAdj = has(r-1)||has(r+1);
const hasGap = has(r-2)||has(r+2);
if(worst.count===1 && !hasAdj && !hasGap) {
hint += ` — it's completely isolated, no neighboring tiles in ${worst.tile.en.split(' ')[1]}.`;
} else if(worst.count===1 && !hasAdj && hasGap) {
hint += ` — only a gap connection, hard to complete a sequence.`;
} else {
hint += ` — least connected tile in your hand.`;
}
} else {
hint += ` — least useful tile.`;
}

// What to protect
if(best.count>=3) {
hint += ` Keep your ${tileName(best.tile)} triplet — strong pung.`;
} else if(best.count>=2) {
hint += ` Protect your ${tileName(best.tile)} pair.`;
}

return hint;
}

function getCallHint(callOptions, hand, discardedTile, melds) {
if(!callOptions||!discardedTile) return null;
const hints = [];
const meldCount = melds.length;
const setsNeeded = 4 - meldCount;
const tileName = discardedTile.en;

if(callOptions.includes(“win”)) {
return `🎯 You can WIN with ${tileName}! Take it!`;
}

if(callOptions.includes(“kong”)) {
hints.push(`Kong the ${tileName} — you have 3 in hand. Gives a bonus draw but fully exposes the set.`);
}

if(callOptions.includes(“pung”)) {
if(discardedTile.type===“dragon”) {
hints.push(`Pung the ${tileName}! Dragon pungs earn fan points and bring you closer to winning.`);
} else if(discardedTile.type===“wind”) {
hints.push(`Pung the ${tileName}. Wind pungs can earn fan if it matches your seat or prevailing wind.`);
} else {
if(setsNeeded<=2) {
hints.push(`Pung the ${tileName} — you only need ${setsNeeded} more set${setsNeeded>1?"s":""}.`);
} else {
hints.push(`Pung ${tileName} is available, but you still need ${setsNeeded} sets. Calling early exposes your hand.`);
}
}
}

if(callOptions.includes(“chow”)) {
// Show what sequences are possible
if(discardedTile.type===“suit”) {
const r=discardedTile.rank, s=discardedTile.suit;
const suitName={wan:“Characters”,tong:“Dots”,tiao:“Bamboo”}[s];
const has=(rank)=>hand.some(t=>t.suit===s&&t.rank===rank);
const seqs=[];
if(r>=3&&has(r-2)&&has(r-1)) seqs.push(`${r-2}-${r-1}-${r}`);
if(r>=2&&r<=8&&has(r-1)&&has(r+1)) seqs.push(`${r-1}-${r}-${r+1}`);
if(r<=7&&has(r+1)&&has(r+2)) seqs.push(`${r}-${r+1}-${r+2}`);
const seqStr = seqs.map(s=>`${s} ${suitName}`).join(” or “);
if(setsNeeded<=2) {
hints.push(`Chow to form ${seqStr} — you only need ${setsNeeded} more set${setsNeeded>1?"s":""}.`);
} else {
hints.push(`Chow available: ${seqStr}. Useful but exposes tiles early.`);
}
}
}

if(!callOptions.some(o=>[“pung”,“kong”,“chow”,“win”].includes(o))) {
return “No calls available — draw from the wall.”;
}

if(meldCount>=2 && hints.length>0) {
hints.push(“You already have exposed melds — another call pushes toward a win but gives opponents more info.”);
}

return hints.join(” “);
}

const BOT_NAMES = [“East Bot”, “South Bot”, “West Bot”];
const SEAT_LABELS = [“You (East)”, “South”, “West”, “North”];
const SEAT_WINDS = [“東”, “南”, “西”, “北”];

// ─── SVG Tile Renderers ───

function DotPattern({ count, size }) {
const s = size;
const r = s * 0.09;
const positions = {
1:[[.5,.5]], 2:[[.35,.35],[.65,.65]], 3:[[.5,.25],[.25,.7],[.75,.7]],
4:[[.3,.3],[.7,.3],[.3,.7],[.7,.7]], 5:[[.3,.25],[.7,.25],[.5,.5],[.3,.75],[.7,.75]],
6:[[.3,.22],[.7,.22],[.3,.5],[.7,.5],[.3,.78],[.7,.78]],
7:[[.3,.18],[.7,.18],[.5,.38],[.3,.58],[.7,.58],[.35,.82],[.65,.82]],
8:[[.3,.18],[.7,.18],[.3,.4],[.7,.4],[.3,.62],[.7,.62],[.3,.84],[.7,.84]],
9:[[.25,.18],[.5,.18],[.75,.18],[.25,.5],[.5,.5],[.75,.5],[.25,.82],[.5,.82],[.75,.82]],
};
return (
<svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
{(positions[count]||[]).map(([x,y],i) => (
<g key={i}>
<circle cx={x*s} cy={y*s} r={r} fill="#2980b9" stroke="#1a5276" strokeWidth={0.7}/>
<circle cx={x*s} cy={y*s} r={r*0.45} fill="none" stroke="#1a5276" strokeWidth={0.5}/>
<circle cx={x*s-r*0.2} cy={y*s-r*0.2} r={r*0.25} fill="rgba(255,255,255,0.35)"/>
</g>
))}
</svg>
);
}

function BambooPattern({ count, size }) {
const s = size;
if (count === 1) {
return (
<svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
<ellipse cx={s*.5} cy={s*.38} rx={s*.16} ry={s*.22} fill="#388e3c" stroke="#1b5e20" strokeWidth={0.8}/>
<ellipse cx={s*.5} cy={s*.26} rx={s*.09} ry={s*.08} fill="#43a047" stroke="#1b5e20" strokeWidth={0.5}/>
<circle cx={s*.47} cy={s*.24} r={s*.018} fill="#111"/>
<polygon points={`${s*.57},${s*.25} ${s*.66},${s*.24} ${s*.57},${s*.28}`} fill=”#c0392b”/>
<path d={`M${s*.36},${s*.4}Q${s*.18},${s*.3} ${s*.22},${s*.5}`} fill=“none” stroke=”#2e7d32” strokeWidth={1.5}/>
<path d={`M${s*.64},${s*.4}Q${s*.82},${s*.3} ${s*.78},${s*.5}`} fill=“none” stroke=”#2e7d32” strokeWidth={1.5}/>
<line x1={s*.45} y1={s*.58} x2={s*.42} y2={s*.76} stroke="#6d4c41" strokeWidth={0.8}/>
<line x1={s*.55} y1={s*.58} x2={s*.58} y2={s*.76} stroke="#6d4c41" strokeWidth={0.8}/>
</svg>
);
}
const stickW=s*0.08, cols=count<=3?count:count<=4?2:3, rows=Math.ceil(count/cols);
const gap=s*0.04, stickH=rows===1?s*0.7:rows===2?s*0.32:s*0.25;
const sticks=[]; let idx=0;
for(let row=0;row<rows;row++){
const cr=row===rows-1?count-idx:cols;
const rw=cr*stickW+(cr-1)*gap, rx=(s-rw)/2;
const ry=rows===1?s*0.14:s*0.08+row*(stickH+s*0.06);
for(let col=0;col<cr;col++){
const x=rx+col*(stickW+gap); const g=idx%2===0;
sticks.push(<g key={idx}><rect x={x} y={ry} width={stickW} height={stickH} rx={stickW/2}
fill={g?”#2e7d32”:”#c0392b”} stroke={g?”#1b5e20”:”#922b21”} strokeWidth={0.6}/>
<line x1={x+stickW*.2} y1={ry+stickH*.33} x2={x+stickW*.8} y2={ry+stickH*.33} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5}/>
<line x1={x+stickW*.2} y1={ry+stickH*.5} x2={x+stickW*.8} y2={ry+stickH*.5} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5}/>
<line x1={x+stickW*.2} y1={ry+stickH*.67} x2={x+stickW*.8} y2={ry+stickH*.67} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5}/>
</g>); idx++;
}
}
return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>{sticks}</svg>;
}

// Characters: Chinese numeral + 萬 + small number cheat label
function CharacterTile({ rank, size }) {
const s=size;
const numCn=[“一”,“二”,“三”,“四”,“五”,“六”,“七”,“八”,“九”][rank-1];
return (
<svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
<text x={s*.5} y={s*.35} textAnchor="middle" dominantBaseline="central"
fontSize={s*0.38} fontWeight="700" fill="#c0392b" fontFamily="'Noto Serif SC',serif">{numCn}</text>
<text x={s*.5} y={s*.7} textAnchor="middle" dominantBaseline="central"
fontSize={s*0.28} fontWeight="700" fill="#c0392b" fontFamily="'Noto Serif SC',serif">萬</text>
<text x={s*.88} y={s*.14} textAnchor="end" dominantBaseline="central"
fontSize={s*0.18} fontWeight="700" fill="#888" fontFamily="'DM Sans',sans-serif">{rank}</text>
</svg>
);
}

// Winds: Chinese character + small E/S/W/N cheat label
function WindTile({ windKey, size }) {
const s=size;
const chars={east:“東”,south:“南”,west:“西”,north:“北”};
const abbrs={east:“E”,south:“S”,west:“W”,north:“N”};
return (
<svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
<text x={s*.5} y={s*.5} textAnchor="middle" dominantBaseline="central"
fontSize={s*0.55} fontWeight="900" fill="#1a237e" fontFamily="'Noto Serif SC',serif"
stroke="#283593" strokeWidth={0.3}>{chars[windKey]}</text>
<text x={s*.88} y={s*.14} textAnchor="end" dominantBaseline="central"
fontSize={s*0.17} fontWeight="700" fill="#888" fontFamily="'DM Sans',sans-serif">{abbrs[windKey]}</text>
</svg>
);
}

// Dragons: Chinese character + small Red/Grn/Wht cheat label
function DragonTile({ dragonKey, size }) {
const s=size;
const abbrs={red:“Red”,green:“Grn”,white:“Wht”};
const label = <text x={s*.88} y={s*.14} textAnchor="end" dominantBaseline="central"
fontSize={s*0.14} fontWeight="700" fill="#888" fontFamily="'DM Sans',sans-serif">{abbrs[dragonKey]}</text>;

if (dragonKey===“red”) return (
<svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
<rect x={s*.15} y={s*.12} width={s*.7} height={s*.76} rx={3} fill="none" stroke="#c62828" strokeWidth={1.5}/>
<text x={s*.5} y={s*.52} textAnchor="middle" dominantBaseline="central"
fontSize={s*.5} fontWeight="900" fill="#c62828" fontFamily="'Noto Serif SC',serif">中</text>
{label}
</svg>
);
if (dragonKey===“green”) return (
<svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
<text x={s*.5} y={s*.52} textAnchor="middle" dominantBaseline="central"
fontSize={s*.55} fontWeight="900" fill="#2e7d32" fontFamily="'Noto Serif SC',serif" stroke="#1b5e20" strokeWidth={0.4}>發</text>
{label}
</svg>
);
return (
<svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
<rect x={s*.18} y={s*.13} width={s*.64} height={s*.74} rx={2} fill="none" stroke="#1565c0" strokeWidth={2}/>
<rect x={s*.26} y={s*.21} width={s*.48} height={s*.58} rx={1} fill="none" stroke="#1565c0" strokeWidth={1}/>
{label}
</svg>
);
}

function TileFace({tile,size}) {
if(tile.suit===“tong”) return <DotPattern count={tile.rank} size={size}/>;
if(tile.suit===“tiao”) return <BambooPattern count={tile.rank} size={size}/>;
if(tile.suit===“wan”) return <CharacterTile rank={tile.rank} size={size}/>;
if(tile.type===“wind”) return <WindTile windKey={tile.rank} size={size}/>;
if(tile.type===“dragon”) return <DragonTile dragonKey={tile.rank} size={size}/>;
return null;
}

// ─── Tile Component ───
function Tile({tile,onClick,selected,small,highlight,faceDown,tooltipBelow,isDrawn}) {
const [hovered,setHovered]=useState(false);
const tW=small?38:52, tH=small?52:70, fs=small?32:46;
const ref=useRef(null);
const [flipTooltip,setFlipTooltip]=useState(false);

useEffect(()=>{
if(hovered&&ref.current){
const rect=ref.current.getBoundingClientRect();
setFlipTooltip(tooltipBelow||rect.top<40);
}
},[hovered,tooltipBelow]);

if(faceDown) return (
<div style={{width:tW,height:tH,background:“linear-gradient(145deg,#2d6a4f,#1b4332)”,borderRadius:5,
border:“1px solid #145a32”,display:“inline-flex”,alignItems:“center”,justifyContent:“center”,margin:1,
boxShadow:“1px 2px 4px rgba(0,0,0,0.2)”}}>
<span style={{color:”#a3d9b1”,fontSize:small?14:18,fontWeight:700}}>🀄</span>
</div>
);

const getBg = () => {
if(selected) return “linear-gradient(145deg,#fef9c3,#fde68a)”;
if(isDrawn) return “linear-gradient(145deg,#e8f5e9,#c8e6c9)”;
if(highlight) return “linear-gradient(145deg,#fce4ec,#f8bbd0)”;
return “linear-gradient(145deg,#fffff8,#ebe6d5)”;
};
const getBorder = () => {
if(selected) return “2px solid #d97706”;
if(isDrawn) return “2px solid #43a047”;
if(highlight) return “2px solid #e91e63”;
return “1.5px solid #a89e8a”;
};
const getShadow = () => {
if(selected) return “0 0 10px rgba(217,119,6,0.5)”;
if(isDrawn) return “0 0 10px rgba(67,160,71,0.5)”;
if(highlight) return “0 0 8px rgba(233,30,99,0.3)”;
return “1px 2px 5px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.7)”;
};

return (
<div ref={ref} onClick={onClick} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
style={{width:tW,height:tH,
background:getBg(),borderRadius:5,border:getBorder(),
display:“inline-flex”,alignItems:“center”,justifyContent:“center”,
cursor:onClick?“pointer”:“default”,margin:1,
boxShadow:getShadow(),
transition:“all 0.15s”,transform:selected?“translateY(-6px)”:“none”,userSelect:“none”,position:“relative”,
overflow:“visible”,
}}>
<TileFace tile={tile} size={fs}/>
{isDrawn&&!selected&&<div style={{position:“absolute”,top:-6,right:-4,background:”#43a047”,color:”#fff”,
fontSize:7,fontWeight:700,padding:“1px 3px”,borderRadius:3,fontFamily:”‘DM Sans’,sans-serif”,
boxShadow:“0 1px 3px rgba(0,0,0,0.3)”}}>NEW</div>}
{hovered&&(<div style={{position:“absolute”,
…(flipTooltip
? {top:“calc(100% + 5px)”}
: {bottom:“calc(100% + 5px)”}),
left:“50%”,transform:“translateX(-50%)”,
background:“rgba(20,20,20,0.94)”,color:”#fff”,padding:“4px 8px”,borderRadius:5,fontSize:11,
whiteSpace:“nowrap”,zIndex:200,pointerEvents:“none”,fontFamily:”‘DM Sans’,sans-serif”,
boxShadow:“0 2px 10px rgba(0,0,0,0.4)”}}>
<span style={{fontFamily:”‘Noto Serif SC’,serif”,marginRight:4}}>{tile.cn}</span>
<span style={{opacity:0.8}}>{tile.en}</span>
</div>)}
</div>
);
}

// ─── Discard Pool ───
function DiscardPool({discards,lastDiscard}) {
return (
<div style={{display:“flex”,flexWrap:“wrap”,gap:2,padding:“12px 8px 8px”,background:“rgba(255,255,255,0.5)”,
borderRadius:8,minHeight:56,maxHeight:200,overflowY:“auto”,overflowX:“visible”,border:“1px solid #ddd”,position:“relative”}}>
{!discards.length&&<span style={{color:”#999”,fontSize:12,fontStyle:“italic”,padding:4}}>No discards yet</span>}
{discards.map((d,i)=><Tile key={`d-${d.tile.id}-${i}`} tile={d.tile} small tooltipBelow highlight={lastDiscard&&d.tile.id===lastDiscard.id}/>)}
</div>
);
}

// ─── Exposed Melds Display ───
function ExposedMelds({melds}) {
if(!melds||!melds.length) return null;
return (
<div style={{display:“flex”,gap:6,flexWrap:“wrap”,marginTop:4}}>
{melds.map((meld,i)=>(
<div key={i} style={{display:“flex”,gap:1,padding:“3px 4px”,background:“rgba(255,255,255,0.12)”,
borderRadius:5,border:“1px solid rgba(255,255,255,0.15)”}}>
<span style={{fontSize:8,color:”#a3d9b1”,position:“relative”,top:-2,marginRight:2,fontWeight:700,
fontFamily:”‘DM Sans’,sans-serif”}}>{meld.type}</span>
{meld.tiles.map(t=><Tile key={t.id} tile={t} small/>)}
</div>
))}
</div>
);
}

// ─── Tile Legend ───
function TileLegend({show,onToggle}) {
if(!show) return (
<button onClick={onToggle} style={{padding:“6px 14px”,borderRadius:6,border:“1px solid #8d6e63”,
background:“linear-gradient(145deg,#efebe9,#d7ccc8)”,color:”#4e342e”,cursor:“pointer”,fontSize:12,
fontFamily:”‘DM Sans’,sans-serif”,fontWeight:600}}>📖 Tile Reference</button>
);
return (
<div style={{background:“linear-gradient(145deg,#faf7f2,#f0ead6)”,borderRadius:10,padding:14,
border:“1px solid #c9b99a”,maxHeight:400,overflowY:“auto”}}>
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,marginBottom:10}}>
<span style={{fontWeight:700,fontSize:14,fontFamily:”‘DM Sans’,sans-serif”,color:”#3e2723”}}>📖 Tile Reference</span>
<button onClick={onToggle} style={{background:“none”,border:“none”,cursor:“pointer”,fontSize:16,color:”#888”}}>✕</button>
</div>
{SUITS.map(suit=>(
<div key={suit.key} style={{marginBottom:10}}>
<div style={{fontSize:11,fontWeight:700,color:suit.color,marginBottom:4,fontFamily:”‘DM Sans’,sans-serif”,
textTransform:“uppercase”,letterSpacing:“0.05em”}}>{suit.cn} {suit.en}</div>
<div style={{display:“flex”,flexWrap:“wrap”,gap:3}}>
{RANKS.map(r=>{
const t={type:“suit”,suit:suit.key,rank:r.n,cn:`${r.cn}${suit.cn}`,en:`${r.n} ${suit.en}`,color:suit.color};
return (<div key={r.n} style={{display:“flex”,flexDirection:“column”,alignItems:“center”,
background:”#fff”,borderRadius:5,padding:3,border:“1px solid #ddd”,minWidth:36}}>
<TileFace tile={t} size={28}/><span style={{fontSize:8,color:”#555”,marginTop:1,fontWeight:600}}>{r.n}</span>
</div>);
})}
</div>
</div>
))}
<div style={{marginBottom:10}}>
<div style={{fontSize:11,fontWeight:700,color:”#1a237e”,marginBottom:4,fontFamily:”‘DM Sans’,sans-serif”,
textTransform:“uppercase”,letterSpacing:“0.05em”}}>Winds</div>
<div style={{display:“flex”,gap:3}}>
{WINDS.map(w=>{
const t={type:“wind”,suit:“wind”,rank:w.key,cn:w.cn,en:`${w.en} Wind`};
return (<div key={w.key} style={{display:“flex”,flexDirection:“column”,alignItems:“center”,
background:”#fff”,borderRadius:5,padding:3,border:“1px solid #ddd”}}>
<TileFace tile={t} size={28}/><span style={{fontSize:8,color:”#555”,marginTop:1,fontWeight:600}}>{w.en}</span>
</div>);
})}
</div>
</div>
<div style={{marginBottom:10}}>
<div style={{fontSize:11,fontWeight:700,color:”#333”,marginBottom:4,fontFamily:”‘DM Sans’,sans-serif”,
textTransform:“uppercase”,letterSpacing:“0.05em”}}>Dragons</div>
<div style={{display:“flex”,gap:3}}>
{DRAGONS.map(d=>{
const t={type:“dragon”,suit:“dragon”,rank:d.key,cn:d.cn,en:`${d.en} Dragon`,color:d.color};
return (<div key={d.key} style={{display:“flex”,flexDirection:“column”,alignItems:“center”,
background:”#fff”,borderRadius:5,padding:3,border:“1px solid #ddd”}}>
<TileFace tile={t} size={28}/><span style={{fontSize:8,color:”#555”,marginTop:1,fontWeight:600}}>{d.en}</span>
</div>);
})}
</div>
</div>
<div style={{padding:8,background:”#fff8e1”,borderRadius:6,border:“1px solid #ffe082”}}>
<div style={{fontSize:11,fontWeight:700,color:”#4e342e”,marginBottom:4,fontFamily:”‘DM Sans’,sans-serif”}}>Quick Terms</div>
<div style={{fontSize:10,color:”#555”,lineHeight:1.6,fontFamily:”‘DM Sans’,sans-serif”}}>
<b>Chow</b> (吃) — 3 consecutive, same suit<br/>
<b>Pung</b> (碰) — 3 identical tiles<br/>
<b>Kong</b> (槓) — 4 identical tiles<br/>
<b>Pair</b> (將) — 2 identical (needed to win)<br/>
<b>Win</b> (胡) — 4 sets + 1 pair, min 8 fan
</div>
</div>
</div>
);
}

// ─── Call Action Buttons ───
function CallButtons({options, onCall, onSkip, lastDiscard}) {
const btnStyle = (bg, shadow) => ({
padding:“7px 16px”,borderRadius:7,border:“none”,color:”#fff”,cursor:“pointer”,
fontSize:13,fontWeight:700,fontFamily:”‘DM Sans’,sans-serif”,
background:bg,boxShadow:`0 2px 8px ${shadow}`,
});
const hasRealCalls = options.some(o=>o!==“none”);
return (
<div style={{textAlign:“center”,padding:“10px 8px”,margin:“0 0 8px”,
background:hasRealCalls?“rgba(255,193,7,0.12)”:“rgba(255,255,255,0.08)”,
borderRadius:8,border:hasRealCalls?“1px solid rgba(255,193,7,0.3)”:“1px solid rgba(255,255,255,0.15)”}}>
<div style={{fontSize:12,color:”#fef3c7”,marginBottom:4,fontWeight:600}}>
Last discard: <span style={{fontFamily:”‘Noto Serif SC’,serif”,fontSize:16}}>{lastDiscard.cn}</span> ({lastDiscard.en})
</div>
<div style={{display:“flex”,alignItems:“center”,justifyContent:“center”,marginBottom:8}}>
<Tile tile={lastDiscard} small highlight/>
</div>
{hasRealCalls&&(
<div style={{fontSize:11,color:”#ffcc80”,marginBottom:6}}>You can claim this tile:</div>
)}
<div style={{display:“flex”,gap:8,justifyContent:“center”,flexWrap:“wrap”}}>
{options.includes(“win”)&&<button onClick={()=>onCall(“win”)} style={btnStyle(“linear-gradient(145deg,#ff6f00,#e65100)”,“rgba(230,81,0,0.4)”)}>胡 Win</button>}
{options.includes(“kong”)&&<button onClick={()=>onCall(“kong”)} style={btnStyle(“linear-gradient(145deg,#7b1fa2,#4a148c)”,“rgba(74,20,140,0.4)”)}>槓 Kong</button>}
{options.includes(“pung”)&&<button onClick={()=>onCall(“pung”)} style={btnStyle(“linear-gradient(145deg,#1565c0,#0d47a1)”,“rgba(13,71,161,0.4)”)}>碰 Pung</button>}
{options.includes(“chow”)&&<button onClick={()=>onCall(“chow”)} style={btnStyle(“linear-gradient(145deg,#2e7d32,#1b5e20)”,“rgba(27,94,32,0.4)”)}>吃 Chow</button>}
<button onClick={onSkip} style={btnStyle(“linear-gradient(145deg,#f9a825,#f57f17)”,“rgba(249,168,37,0.3)”)}>
Draw from Wall
</button>
</div>
</div>
);
}

// ─── Chow Picker ───
function ChowPicker({combos, discardedTile, onPick, onCancel}) {
return (
<div style={{textAlign:“center”,padding:“10px 8px”,margin:“0 0 8px”,
background:“rgba(46,125,50,0.15)”,borderRadius:8,border:“1px solid rgba(46,125,50,0.3)”}}>
<div style={{fontSize:12,color:”#a5d6a7”,marginBottom:8,fontWeight:600}}>Choose your chow combination:</div>
<div style={{display:“flex”,gap:8,justifyContent:“center”,flexWrap:“wrap”}}>
{combos.map((combo,i)=>{
const allThree = sortHand([…combo, discardedTile]);
return (
<button key={i} onClick={()=>onPick(combo)} style={{display:“flex”,gap:2,padding:“4px 6px”,
background:“rgba(255,255,255,0.1)”,borderRadius:6,border:“1px solid rgba(255,255,255,0.2)”,
cursor:“pointer”,alignItems:“center”}}>
{allThree.map(t=><Tile key={t.id} tile={t} small/>)}
</button>
);
})}
</div>
<button onClick={onCancel} style={{marginTop:6,padding:“4px 12px”,borderRadius:5,border:“1px solid #666”,
background:“transparent”,color:”#aaa”,cursor:“pointer”,fontSize:11,fontFamily:”‘DM Sans’,sans-serif”}}>Cancel</button>
</div>
);
}

// ─── Main Game ───
const PLAYER_NAMES = [“You”, “East Bot”, “South Bot”, “West Bot”];

function addLog(prev, playerIdx, action, tile) {
return […prev.gameLog, {
turn: prev.turnCount,
player: PLAYER_NAMES[playerIdx],
playerIdx,
action,
tile: tile ? {…tile} : null,
timestamp: Date.now(),
}];
}

function initGame() {
const deck=shuffle(buildDeck());
const hands=[[],[],[],[]];
for(let i=0;i<13;i++) for(let p=0;p<4;p++) hands[p].push(deck.pop());
return {
wall:deck, hands:hands.map(h=>sortHand(h)),
discards:[[],[],[],[]], melds:[[],[],[],[]],
currentPlayer:0, phase:“draw”, drawnTile:null,
message:“Your turn — draw a tile from the wall.”,
lastDiscard:null, lastDiscardPlayer:null,
winner:null, turnCount:0,
callOptions:null, chowCombos:null,
awaitingCall:false,
gameLog:[],
};
}

export default function MahjongGame() {
const [game,setGame]=useState(()=>initGame());
const [selectedTile,setSelectedTile]=useState(null);
const [showLegend,setShowLegend]=useState(false);
const [showAllDiscards,setShowAllDiscards]=useState(false);
const [showHints,setShowHints]=useState(true);
const [showLog,setShowLog]=useState(false);
const botTimerRef=useRef(null);
const isPlayerTurn=game.currentPlayer===0;

// Draw
const drawTile=useCallback(()=>{
if(game.phase!==“draw”||!isPlayerTurn||game.wall.length===0) return;
setGame(prev=>{
const wall=[…prev.wall]; const tile=wall.pop();
const newHand=sortHand([…prev.hands[0],tile]);
const hands=prev.hands.map((h,i)=>i===0?newHand:[…h]);
const isWin=checkWin(newHand,prev.melds[0]);
return {…prev,wall,hands,drawnTile:tile,
phase:isWin?“gameover”:“discard”,
message:isWin?“🎉 You win!”:`Drew ${tile.cn} (${tile.en}). Select a tile to discard.`,
winner:isWin?0:null, callOptions:null, chowCombos:null, awaitingCall:false,
gameLog:addLog(prev,0,“Drew”,tile),
};
});
setSelectedTile(null);
},[game.phase,isPlayerTurn,game.wall.length]);

// Discard
const discardTile=useCallback(()=>{
if(game.phase!==“discard”||!isPlayerTurn||selectedTile===null) return;
setGame(prev=>{
const hand=[…prev.hands[0]];
const idx=hand.findIndex(t=>t.id===selectedTile);
if(idx===-1) return prev;
const [discarded]=hand.splice(idx,1);
const sorted=sortHand(hand);
const discards=prev.discards.map((d,i)=>i===0?[…d,{tile:discarded,player:0}]:[…d]);
return {…prev,hands:prev.hands.map((h,i)=>i===0?sorted:[…h]),
discards,currentPlayer:1,phase:“draw”,drawnTile:null,
lastDiscard:discarded,lastDiscardPlayer:0,
message:“Bots playing…”,turnCount:prev.turnCount+1,
callOptions:null,chowCombos:null,awaitingCall:false,
gameLog:addLog(prev,0,“Discarded”,discarded),
};
});
setSelectedTile(null);
},[game.phase,isPlayerTurn,selectedTile]);

// Handle call
const handleCall=useCallback((callType)=>{
setGame(prev=>{
const tile=prev.lastDiscard;
const hand=[…prev.hands[0]];
const log=(action,t)=>addLog(prev,0,action,t||tile);

```
  if(callType==="win") {
    const winHand=sortHand([...hand,tile]);
    return {...prev,hands:prev.hands.map((h,i)=>i===0?winHand:[...h]),
      phase:"gameover",winner:0,message:"🎉 You win by discard!",
      callOptions:null,chowCombos:null,awaitingCall:false,
      discards:prev.discards.map((d,i)=>i===prev.lastDiscardPlayer?d.slice(0,-1):[...d]),
      gameLog:log("Won with"),
    };
  }

  if(callType==="kong") {
    const toRemove=hand.filter(t=>t.suit===tile.suit&&t.rank===tile.rank).slice(0,3);
    const remaining=hand.filter(t=>!toRemove.find(r=>r.id===t.id));
    const meldTiles=[...toRemove,tile];
    const newMelds=prev.melds.map((m,i)=>i===0?[...m,{type:"Kong",tiles:meldTiles}]:[...m]);
    const wall=[...prev.wall];
    if(wall.length===0) return {...prev,phase:"gameover",message:"Wall empty — draw!",awaitingCall:false};
    const replacement=wall.pop();
    const newHand=sortHand([...remaining,replacement]);
    const isWin=checkWin(newHand,newMelds[0]);
    return {...prev,wall,hands:prev.hands.map((h,i)=>i===0?newHand:[...h]),
      melds:newMelds,phase:isWin?"gameover":"discard",
      winner:isWin?0:null,
      message:isWin?"🎉 You win!":"Kong! Drew replacement. Select a tile to discard.",
      discards:prev.discards.map((d,i)=>i===prev.lastDiscardPlayer?d.slice(0,-1):[...d]),
      callOptions:null,chowCombos:null,drawnTile:replacement,awaitingCall:false,currentPlayer:0,
      gameLog:log("Called Kong"),
    };
  }

  if(callType==="pung") {
    const toRemove=hand.filter(t=>t.suit===tile.suit&&t.rank===tile.rank).slice(0,2);
    const remaining=sortHand(hand.filter(t=>!toRemove.find(r=>r.id===t.id)));
    const meldTiles=[...toRemove,tile];
    const newMelds=prev.melds.map((m,i)=>i===0?[...m,{type:"Pung",tiles:meldTiles}]:[...m]);
    const isWin=checkWin(remaining,newMelds[0]);
    if(isWin) {
      return {...prev,hands:prev.hands.map((h,i)=>i===0?remaining:[...h]),
        melds:newMelds,phase:"gameover",winner:0,
        message:"🎉 You win! Pung completed your hand!",
        discards:prev.discards.map((d,i)=>i===prev.lastDiscardPlayer?d.slice(0,-1):[...d]),
        callOptions:null,chowCombos:null,currentPlayer:0,awaitingCall:false,
        gameLog:log("Won with Pung"),
      };
    }
    return {...prev,hands:prev.hands.map((h,i)=>i===0?remaining:[...h]),
      melds:newMelds,phase:"discard",
      message:"Pung! Select a tile to discard.",
      discards:prev.discards.map((d,i)=>i===prev.lastDiscardPlayer?d.slice(0,-1):[...d]),
      callOptions:null,chowCombos:null,currentPlayer:0,awaitingCall:false,
      gameLog:log("Called Pung"),
    };
  }

  if(callType==="chow") {
    const combos=getChowCombos(hand,tile);
    if(combos.length===1) {
      const toRemove=combos[0];
      const remaining=sortHand(hand.filter(t=>!toRemove.find(r=>r.id===t.id)));
      const meldTiles=sortHand([...toRemove,tile]);
      const newMelds=prev.melds.map((m,i)=>i===0?[...m,{type:"Chow",tiles:meldTiles}]:[...m]);
      const isWin=checkWin(remaining,newMelds[0]);
      if(isWin) {
        return {...prev,hands:prev.hands.map((h,i)=>i===0?remaining:[...h]),
          melds:newMelds,phase:"gameover",winner:0,
          message:"🎉 You win! Chow completed your hand!",
          discards:prev.discards.map((d,i)=>i===prev.lastDiscardPlayer?d.slice(0,-1):[...d]),
          callOptions:null,chowCombos:null,currentPlayer:0,awaitingCall:false,
          gameLog:log("Won with Chow"),
        };
      }
      return {...prev,hands:prev.hands.map((h,i)=>i===0?remaining:[...h]),
        melds:newMelds,phase:"discard",
        message:"Chow! Select a tile to discard.",
        discards:prev.discards.map((d,i)=>i===prev.lastDiscardPlayer?d.slice(0,-1):[...d]),
        callOptions:null,chowCombos:null,currentPlayer:0,awaitingCall:false,
        gameLog:log("Called Chow"),
      };
    }
    return {...prev,chowCombos:combos,callOptions:null,awaitingCall:false};
  }
  return prev;
});
```

},[]);

// Handle chow pick
const handleChowPick=useCallback((combo)=>{
setGame(prev=>{
const tile=prev.lastDiscard;
const hand=[…prev.hands[0]];
const remaining=sortHand(hand.filter(t=>!combo.find(r=>r.id===t.id)));
const meldTiles=sortHand([…combo,tile]);
const newMelds=prev.melds.map((m,i)=>i===0?[…m,{type:“Chow”,tiles:meldTiles}]:[…m]);
const isWin=checkWin(remaining,newMelds[0]);
if(isWin) {
return {…prev,hands:prev.hands.map((h,i)=>i===0?remaining:[…h]),
melds:newMelds,phase:“gameover”,winner:0,
message:“🎉 You win! Chow completed your hand!”,
discards:prev.discards.map((d,i)=>i===prev.lastDiscardPlayer?d.slice(0,-1):[…d]),
callOptions:null,chowCombos:null,currentPlayer:0,awaitingCall:false,
};
}
return {…prev,hands:prev.hands.map((h,i)=>i===0?remaining:[…h]),
melds:newMelds,phase:“discard”,
message:“Chow! Select a tile to discard.”,
discards:prev.discards.map((d,i)=>i===prev.lastDiscardPlayer?d.slice(0,-1):[…d]),
callOptions:null,chowCombos:null,currentPlayer:0,awaitingCall:false,
};
});
},[]);

const skipCall=useCallback(()=>{
setGame(prev=>{
// If this was a mid-round interrupt, resume bot turns from the queued next player
if(prev.currentPlayer!==0) {
return {…prev,callOptions:null,chowCombos:null,phase:“draw”,
awaitingCall:false,lastDiscardPlayer:null};
}
// Normal turn skip — let player draw from wall
return {…prev,callOptions:null,chowCombos:null,phase:“draw”,
awaitingCall:false,lastDiscardPlayer:null,
message:“Your turn — draw a tile.”};
});
},[]);

// Bot turns + call checks
useEffect(()=>{
if(game.phase===“gameover”) return;
// If we’re showing call options or chow picker, wait for player input
if(game.callOptions||game.chowCombos) return;
// If awaiting call resolution, show the options now
if(game.awaitingCall&&game.lastDiscard) {
const opts=getCallOptions(game.hands[0],game.lastDiscard,game.melds[0]);
// Chow only from left neighbor (player 3). Pung/Kong/Win from anyone.
const fromPlayer=game.lastDiscardPlayer;
const filtered = fromPlayer===3 ? opts : opts.filter(o=>o!==“chow”);
// Always show prompt when it’s player’s turn so they see every discard
const isMyTurn = game.currentPlayer===0;
const toShow = filtered.length>0 ? filtered : (isMyTurn ? [“none”] : []);
if(toShow.length>0) {
setGame(prev=>({…prev,callOptions:toShow,awaitingCall:false}));
return;
}
// No calls possible and not player’s natural turn — continue bot play
setGame(prev=>({…prev,awaitingCall:false,lastDiscardPlayer:null}));
return;
}

```
// Safety net: if it's player's turn and there's an unprocessed bot discard, show call prompt
if(game.currentPlayer===0 && game.phase==="draw" && game.lastDiscard && game.lastDiscardPlayer!==null && game.lastDiscardPlayer!==0 && !game.awaitingCall) {
  const opts=getCallOptions(game.hands[0],game.lastDiscard,game.melds[0]);
  const fromPlayer=game.lastDiscardPlayer;
  const filtered = fromPlayer===3 ? opts : opts.filter(o=>o!=="chow");
  const toShow = filtered.length>0 ? filtered : ["none"];
  setGame(prev=>({...prev,callOptions:toShow}));
  return;
}

if(game.currentPlayer===0) return;
if(game.wall.length===0) {
  setGame(prev=>({...prev,phase:"gameover",message:"Wall empty — draw game!"}));
  return;
}

botTimerRef.current=setTimeout(()=>{
  setGame(prev=>{
    const cp=prev.currentPlayer;
    const wall=[...prev.wall];
    if(!wall.length) return {...prev,phase:"gameover",message:"Wall empty — draw game!"};

    // Before this bot draws, check if it can call the last discard (pung/kong from any player)
    if(prev.lastDiscard&&prev.lastDiscardPlayer!==null&&prev.lastDiscardPlayer!==cp) {
      const botHand=prev.hands[cp];
      const dTile=prev.lastDiscard;
      const dKey=`${dTile.suit}-${dTile.rank}`;
      const matchCount=botHand.filter(t=>t.suit===dTile.suit&&t.rank===dTile.rank).length;

      // Bot calls pung if it has 2 matching (50% chance to add some variety)
      if(matchCount>=2&&Math.random()<0.5) {
        const toRemove=botHand.filter(t=>t.suit===dTile.suit&&t.rank===dTile.rank).slice(0,2);
        const remaining=botHand.filter(t=>!toRemove.find(r=>r.id===t.id));
        const meldTiles=[...toRemove,dTile];
        const newMelds=prev.melds.map((m,i)=>i===cp?[...m,{type:"Pung",tiles:meldTiles}]:[...m]);
        // Bot now discards from remaining
        const disc=botDiscard(remaining);
        const dIdx=remaining.findIndex(t=>t.id===disc.id);
        remaining.splice(dIdx,1);
        const sorted=sortHand(remaining);
        const discards=prev.discards.map((d,i)=>{
          if(i===prev.lastDiscardPlayer) return d.slice(0,-1); // remove called tile
          if(i===cp) return [...d,{tile:disc,player:cp}];
          return [...d];
        });
        const nextPlayer=(cp+1)%4;
        return {...prev,hands:prev.hands.map((h,i)=>i===cp?sorted:[...h]),
          melds:newMelds,discards,currentPlayer:nextPlayer,phase:"draw",
          lastDiscard:disc,lastDiscardPlayer:cp,awaitingCall:true,
          message:`${BOT_NAMES[cp-1]} called Pung! Discarded ${disc.cn} (${disc.en}).`,
          turnCount:prev.turnCount+1,callOptions:null,chowCombos:null,
          gameLog:[...addLog(prev,cp,"Called Pung",dTile),
            {turn:prev.turnCount,player:PLAYER_NAMES[cp],playerIdx:cp,action:"Discarded",tile:{...disc},timestamp:Date.now()}],
        };
      }
    }

    const tile=wall.pop();
    const hand=sortHand([...prev.hands[cp],tile]);
    if(checkWin(hand,prev.melds[cp])) {
      return {...prev,wall,hands:prev.hands.map((h,i)=>i===cp?hand:[...h]),
        phase:"gameover",winner:cp,message:`${BOT_NAMES[cp-1]} wins!`,
        gameLog:addLog(prev,cp,"Won"),
      };
    }
    const toDiscard=botDiscard(hand);
    const idx=hand.findIndex(t=>t.id===toDiscard.id);
    hand.splice(idx,1);
    const sorted=sortHand(hand);
    const discards=prev.discards.map((d,i)=>i===cp?[...d,{tile:toDiscard,player:cp}]:[...d]);
    const nextPlayer=(cp+1)%4;

    // Always pause after a bot discard to check if player can call
    return {...prev,wall,hands:prev.hands.map((h,i)=>i===cp?sorted:[...h]),
      discards,currentPlayer:nextPlayer,phase:"draw",
      lastDiscard:toDiscard,lastDiscardPlayer:cp,
      awaitingCall:true,
      message:`${BOT_NAMES[cp-1]} discarded ${toDiscard.cn} (${toDiscard.en}).${nextPlayer===0?" Your turn.":""}`,
      turnCount:prev.turnCount+1,callOptions:null,chowCombos:null,
      gameLog:addLog(prev,cp,"Discarded",toDiscard),
    };
  });
},2000);
return ()=>clearTimeout(botTimerRef.current);
```

},[game.currentPlayer,game.phase,game.turnCount,game.callOptions,game.chowCombos,game.awaitingCall,game.lastDiscard,game.lastDiscardPlayer,game.hands,game.wall.length]);

const allDiscards=game.discards.flat();
const newGame=()=>{setGame(initGame());setSelectedTile(null);setShowAllDiscards(false);};

return (
<div style={{minHeight:“100vh”,background:“linear-gradient(160deg,#1b4332 0%,#2d6a4f 40%,#245a3a 100%)”,
fontFamily:”‘DM Sans’,sans-serif”,padding:“12px 8px”,boxSizing:“border-box”}}>
<link href="https://urldefense.com/v3/__https://fonts.googleapis.com/css2?family=DM*Sans:wght@400;500;600;700&family=Noto*Serif*SC:wght@400;700&display=swap__;Kysr!!L1aKtqoz4WY!YFFEk4uY6xMm2dHLv2ASAtG2p9_yztgU6XeotMchmnaPF8edmRftL-P_qoEPuZ3foHHpz0xDGwluDVR2YEBJFg$ " rel="stylesheet"/>

```
  {/* Header */}
  <div style={{textAlign:"center",marginBottom:10,padding:"8px 12px",background:"rgba(0,0,0,0.2)",borderRadius:10}}>
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:10}}>
      <span style={{fontSize:22,fontWeight:700,color:"#fef3c7",fontFamily:"'Noto Serif SC',serif"}}>麻將</span>
      <span style={{fontSize:16,fontWeight:600,color:"#a3d9b1"}}>Chinese Mahjong</span>
    </div>
    <div style={{fontSize:11,color:"#7dcea0",marginTop:2}}>Wall: {game.wall.length} · Turn {game.turnCount+1}</div>
  </div>

  {/* Bots */}
  <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
    <div style={{display:"flex",justifyContent:"space-around"}}>
      {[1,2,3].map(i=>(
        <div key={i} style={{textAlign:"center",padding:"4px 10px",
          background:game.currentPlayer===i?"rgba(255,193,7,0.25)":"rgba(255,255,255,0.08)",
          borderRadius:8,border:game.currentPlayer===i?"1px solid rgba(255,193,7,0.4)":"1px solid transparent"}}>
          <div style={{fontSize:16}}>{SEAT_WINDS[i]}</div>
          <div style={{fontSize:10,color:"#a3d9b1",fontWeight:600}}>{BOT_NAMES[i-1]}</div>
          {game.currentPlayer===i&&game.phase!=="gameover"&&<div style={{fontSize:9,color:"#ffd54f",marginTop:1,fontStyle:"italic"}}>thinking...</div>}
          <div style={{display:"flex",gap:1,justifyContent:"center",marginTop:3}}>
            {Array.from({length:Math.min(game.hands[i]?.length||0,13)}).map((_,j)=>(
              <div key={j} style={{width:5,height:9,background:"#2d6a4f",borderRadius:1,border:"1px solid #1b4332"}}/>
            ))}
          </div>
        </div>
      ))}
    </div>
    {/* Bot exposed melds */}
    {[1,2,3].some(i=>game.melds[i]?.length>0)&&(
      <div style={{padding:"6px 8px",background:"rgba(0,0,0,0.15)",borderRadius:8,
        border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{fontSize:10,color:"#7dcea0",fontWeight:700,marginBottom:4,textTransform:"uppercase",
          letterSpacing:"0.05em"}}>Exposed Melds</div>
        {[1,2,3].map(i=>(
          game.melds[i]?.length>0&&(
            <div key={i} style={{marginBottom:4}}>
              <div style={{fontSize:9,color:"#a3d9b1",marginBottom:2,fontWeight:600}}>
                {SEAT_WINDS[i]} {BOT_NAMES[i-1]}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {game.melds[i].map((meld,mi)=>(
                  <div key={mi} style={{display:"flex",gap:1,padding:"2px 3px",
                    background:"rgba(255,255,255,0.08)",borderRadius:4,
                    border:"1px solid rgba(255,255,255,0.1)",alignItems:"center"}}>
                    <span style={{fontSize:7,color:"#ffcc80",marginRight:2,fontWeight:700,
                      fontFamily:"'DM Sans',sans-serif"}}>{meld.type}</span>
                    {meld.tiles.map(t=><Tile key={t.id} tile={t} small/>)}
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    )}
  </div>

  {/* Message */}
  <div style={{textAlign:"center",padding:"8px 12px",margin:"0 0 8px",
    background:game.winner!==null?(game.winner===0?"rgba(46,125,50,0.3)":"rgba(198,40,40,0.2)"):"rgba(255,255,255,0.1)",
    borderRadius:8,color:"#fef3c7",fontSize:13,fontWeight:500}}>
    {game.message}
  </div>

  {/* Call Options */}
  {game.callOptions&&game.lastDiscard&&(
    <CallButtons options={game.callOptions} onCall={handleCall} onSkip={skipCall} lastDiscard={game.lastDiscard}/>
  )}
  {/* Call Hint */}
  {showHints&&game.callOptions&&game.lastDiscard&&(
    <div style={{margin:"0 0 8px",padding:"8px 10px",background:"rgba(33,150,243,0.12)",
      borderRadius:8,border:"1px solid rgba(33,150,243,0.25)",fontSize:12,color:"#bbdefb",
      lineHeight:1.5,fontFamily:"'DM Sans',sans-serif"}}>
      <span style={{fontWeight:700,color:"#90caf9",marginRight:4}}>💡 Hint:</span>
      {getCallHint(game.callOptions,game.hands[0],game.lastDiscard,game.melds[0])}
    </div>
  )}

  {/* Chow Picker */}
  {game.chowCombos&&game.lastDiscard&&(
    <ChowPicker combos={game.chowCombos} discardedTile={game.lastDiscard} onPick={handleChowPick} onCancel={skipCall}/>
  )}

  {/* Discards */}
  <div style={{marginBottom:8}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,padding:"0 4px"}}>
      <span style={{fontSize:12,fontWeight:700,color:"#a3d9b1",textTransform:"uppercase",letterSpacing:"0.05em"}}>
        Discards ({allDiscards.length})
      </span>
      <button onClick={()=>setShowAllDiscards(!showAllDiscards)} style={{
        padding:"3px 8px",borderRadius:4,border:"1px solid #7dcea0",
        background:showAllDiscards?"#2d6a4f":"transparent",
        color:"#a3d9b1",cursor:"pointer",fontSize:10,fontWeight:600,
      }}>{showAllDiscards?"Combined":"By Player"}</button>
    </div>
    {showAllDiscards?(
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {[0,1,2,3].map(p=>(
          <div key={p}>
            <div style={{fontSize:10,color:"#7dcea0",marginBottom:2,fontWeight:600}}>{SEAT_LABELS[p]} ({game.discards[p].length})</div>
            <DiscardPool discards={game.discards[p]} lastDiscard={game.lastDiscard}/>
          </div>
        ))}
      </div>
    ):(
      <DiscardPool discards={allDiscards} lastDiscard={game.lastDiscard}/>
    )}
    {game.lastDiscard&&(
      <div style={{marginTop:4,padding:"4px 8px",background:"rgba(233,30,99,0.1)",
        borderRadius:6,border:"1px solid rgba(233,30,99,0.2)",fontSize:11,color:"#f8bbd0",textAlign:"center"}}>
        Last: <strong style={{fontFamily:"'Noto Serif SC',serif"}}>{game.lastDiscard.cn}</strong> ({game.lastDiscard.en}) · pink
      </div>
    )}
  </div>

  {/* Your Hand */}
  <div style={{background:"rgba(0,0,0,0.25)",borderRadius:12,padding:"10px 6px",marginBottom:8,
    border:isPlayerTurn?"1px solid rgba(255,193,7,0.3)":"1px solid transparent"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,padding:"0 4px"}}>
      <span style={{fontSize:12,fontWeight:700,color:"#fef3c7",textTransform:"uppercase",letterSpacing:"0.05em"}}>
        {SEAT_WINDS[0]} Your Hand ({game.hands[0].length})
      </span>
      {isPlayerTurn&&!game.callOptions&&!game.chowCombos&&(
        <span style={{fontSize:10,padding:"2px 8px",background:"rgba(255,193,7,0.2)",borderRadius:10,color:"#fef3c7",fontWeight:600}}>Your Turn</span>
      )}
    </div>

    {/* Exposed melds */}
    <ExposedMelds melds={game.melds[0]}/>

    <div style={{display:"flex",flexWrap:"wrap",gap:2,justifyContent:"center",padding:4,marginTop:4}}>
      {game.hands[0].map(tile=>(
        <Tile key={tile.id} tile={tile} selected={selectedTile===tile.id}
          isDrawn={game.drawnTile&&tile.id===game.drawnTile.id&&game.phase==="discard"}
          onClick={game.phase==="discard"&&isPlayerTurn&&!game.callOptions&&!game.chowCombos?()=>setSelectedTile(selectedTile===tile.id?null:tile.id):undefined}/>
      ))}
    </div>

    <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:8}}>
      {game.phase==="draw"&&isPlayerTurn&&!game.callOptions&&!game.chowCombos&&game.wall.length>0&&(
        <button onClick={drawTile} style={{padding:"8px 24px",borderRadius:8,border:"none",
          background:"linear-gradient(145deg,#f9a825,#f57f17)",color:"#fff",cursor:"pointer",
          fontSize:14,fontWeight:700,boxShadow:"0 2px 8px rgba(249,168,37,0.4)",fontFamily:"'DM Sans',sans-serif"}}>Draw Tile</button>
      )}
      {game.phase==="discard"&&isPlayerTurn&&!game.callOptions&&!game.chowCombos&&(
        <button onClick={discardTile} disabled={selectedTile===null} style={{
          padding:"8px 24px",borderRadius:8,border:"none",
          background:selectedTile!==null?"linear-gradient(145deg,#ef5350,#c62828)":"#666",
          color:"#fff",cursor:selectedTile!==null?"pointer":"not-allowed",
          fontSize:14,fontWeight:700,opacity:selectedTile!==null?1:0.5,fontFamily:"'DM Sans',sans-serif",
        }}>Discard Selected</button>
      )}
      {game.phase==="gameover"&&(
        <button onClick={newGame} style={{padding:"8px 24px",borderRadius:8,border:"none",
          background:"linear-gradient(145deg,#43a047,#2e7d32)",color:"#fff",cursor:"pointer",
          fontSize:14,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>New Game</button>
      )}
    </div>

    {/* Discard Hint */}
    {showHints&&game.phase==="discard"&&isPlayerTurn&&!game.callOptions&&!game.chowCombos&&(
      <div style={{margin:"8px 4px 0",padding:"8px 10px",background:"rgba(33,150,243,0.12)",
        borderRadius:8,border:"1px solid rgba(33,150,243,0.25)",fontSize:12,color:"#bbdefb",
        lineHeight:1.5,fontFamily:"'DM Sans',sans-serif"}}>
        <span style={{fontWeight:700,color:"#90caf9",marginRight:4}}>💡 Hint:</span>
        {getDiscardHint(game.hands[0],game.melds[0])}
      </div>
    )}
  </div>

  {/* Legend & Hints Toggle */}
  <div style={{marginBottom:12,display:"flex",gap:8,flexWrap:"wrap"}}>
    <TileLegend show={showLegend} onToggle={()=>setShowLegend(!showLegend)}/>
    <button onClick={()=>setShowHints(!showHints)} style={{
      padding:"6px 14px",borderRadius:6,
      border:showHints?"1px solid #64b5f6":"1px solid #666",
      background:showHints?"linear-gradient(145deg,#1565c0,#0d47a1)":"linear-gradient(145deg,#424242,#333)",
      color:showHints?"#fff":"#999",cursor:"pointer",fontSize:12,
      fontFamily:"'DM Sans',sans-serif",fontWeight:600,
    }}>{showHints?"💡 Hints On":"💡 Hints Off"}</button>
  </div>

  {/* Instructions */}
  <div style={{background:"rgba(0,0,0,0.15)",borderRadius:8,padding:"8px 12px",fontSize:10,color:"#7dcea0",lineHeight:1.6}}>
    <strong style={{color:"#a3d9b1"}}>How to play:</strong> Draw → tap to select → discard.
    When a bot discards, you may be offered Chow/Pung/Kong/Win calls.
    Goal: 4 sets + 1 pair. Hover tiles for full name. Pink = last discard.
  </div>

  {/* Game Log */}
  <div style={{marginTop:8}}>
    <button onClick={()=>setShowLog(!showLog)} style={{
      padding:"6px 14px",borderRadius:6,border:"1px solid #5d4037",
      background:showLog?"linear-gradient(145deg,#4e342e,#3e2723)":"linear-gradient(145deg,#efebe9,#d7ccc8)",
      color:showLog?"#d7ccc8":"#4e342e",cursor:"pointer",fontSize:12,
      fontFamily:"'DM Sans',sans-serif",fontWeight:600,width:"100%",textAlign:"left",
    }}>
      📜 Game Log ({game.gameLog.length} plays) {showLog?"▼":"▶"}
    </button>
    {showLog&&(
      <div style={{marginTop:4,background:"rgba(0,0,0,0.3)",borderRadius:8,
        border:"1px solid rgba(255,255,255,0.08)",maxHeight:400,overflowY:"auto",padding:"6px 0"}}>
        {game.gameLog.length===0&&(
          <div style={{padding:"12px",textAlign:"center",color:"#7dcea0",fontSize:11,fontStyle:"italic"}}>
            No plays yet — start the game!
          </div>
        )}
        {[...game.gameLog].reverse().map((entry,i)=>{
          const isYou = entry.playerIdx===0;
          const playerColors = ["#fef3c7","#a3d9b1","#90caf9","#ffcc80"];
          return (
            <div key={i} style={{
              display:"flex",alignItems:"center",gap:6,
              padding:"4px 10px",
              background:i%2===0?"rgba(255,255,255,0.03)":"transparent",
              borderBottom:"1px solid rgba(255,255,255,0.04)",
            }}>
              <div style={{minWidth:52,fontSize:9,color:"#7dcea0",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                Turn {entry.turn+1}
              </div>
              <div style={{minWidth:70,fontSize:10,color:playerColors[entry.playerIdx],
                fontWeight:isYou?700:500,fontFamily:"'DM Sans',sans-serif"}}>
                {entry.player}
              </div>
              <div style={{fontSize:10,color:"#ccc",fontFamily:"'DM Sans',sans-serif",flex:1}}>
                {entry.action}
              </div>
              {entry.tile&&(
                <div style={{flexShrink:0}}>
                  <Tile tile={entry.tile} small/>
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
</div>
```

);
}
