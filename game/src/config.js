export const WIDTH=1280, HEIGHT=720, CELL=360, ROAD=104, COLS=10, ROWS=8;
export const WORLD_W=COLS*CELL, WORLD_H=ROWS*CELL;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const carColors=['#f27d64','#ffd17f','#76c2b7','#a7afb9','#e6ded0','#ba8cba','#658aa8'];
