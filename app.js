import { garment } from './garment-model.js';
import { DrapeRenderer } from './drape-renderer.js';

const canvas=document.querySelector('#view');
const renderer=new DrapeRenderer(canvas);
const slider=document.querySelector('#zip');
const designs=new Map();
let color='black', angle=0, zoom=1, needsMesh=true, scheduled=false;
async function loadDesign(name){
  const response=await fetch('./garment/'+name+'.json');
  if(!response.ok) throw Error('Profil jaket gagal dimuat.');
  const profile=await response.json(), images={};
  await Promise.all(['front','back','pull'].map(async side=>{
    const image=new Image();image.src='./garment/'+name+'-'+side+'.webp';
    await image.decode();images[side]=image;
  }));
  designs.set(name,{profile,images});
}
function redraw(){
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    const {profile,images}=designs.get(color);
    if(needsMesh){renderer.setMesh(garment(profile,Number(slider.value)/100));needsMesh=false;}
    renderer.zoom=zoom;
    renderer.draw(images,angle);
  });
}
function select(name){
  color=name;needsMesh=true;
  for(const b of document.querySelectorAll('.swatch')){
    b.classList.toggle('active',b.dataset.color===name);
    b.setAttribute('aria-pressed',String(b.dataset.color===name));
  }
  redraw();
}
try{
  await Promise.all(['black','white'].map(loadDesign));
  for(const b of document.querySelectorAll('.swatch'))b.onclick=()=>select(b.dataset.color);
  slider.oninput=()=>{needsMesh=true;redraw();};
  const fingers=new Map();
  function separation(){const [a,b]=[...fingers.values()];return Math.hypot(a.x-b.x,a.y-b.y);}
  const setZoom=n=>{zoom=Math.max(.65,Math.min(2,n));redraw();};
  canvas.onpointerdown=e=>{
    fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove=e=>{
    const previous=fingers.get(e.pointerId);if(!previous)return;
    const oldDistance=fingers.size===2?separation():0;
    fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(oldDistance>1){setZoom(zoom*separation()/oldDistance);return;}
    angle+=(e.clientX-previous.x)*Math.PI*2/Math.max(330,canvas.clientWidth*.85);redraw();
  };
  canvas.onlostpointercapture=e=>fingers.delete(e.pointerId);
  canvas.onwheel=e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.001));};
  canvas.tabIndex=0;
  canvas.onkeydown=e=>{
    if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();angle+=e.key==='ArrowLeft'?-.15:.15;redraw();
  };
  new ResizeObserver(redraw).observe(canvas);
  select('black');document.querySelector('#loading').remove();
}catch(err){
  const status=document.querySelector('#loading');status.removeAttribute('id');
  status.textContent='Jaket gagal dimuat. Muat ulang halaman.';console.error(err);
}
