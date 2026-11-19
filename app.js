import * as T from 'three';
import {SoftwareRenderer} from './software.js';
import {OrbitControls} from './vendor/OrbitControls.js';
const canvas=document.querySelector('#view');
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});}catch{renderer=new SoftwareRenderer(canvas);}renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xeeeeec);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.05,100);camera.position.set(0,.35,7.8);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=4.8;controls.maxDistance=10;controls.minPolarAngle=.3;controls.maxPolarAngle=Math.PI-.3;controls.target.set(0,.05,0);controls.rotateSpeed=.65;
scene.add(new T.HemisphereLight(0xffffff,0x92918b,2.7));
for(const [x,y,z,p] of [[3,5,5,85],[-4,3,0,55],[0,4,-4,90]]){const l=new T.DirectionalLight(0xffffff,p/30);l.position.set(x,y,z);scene.add(l);}
const model=new T.Group();scene.add(model);
const loader=new T.TextureLoader();const textures={};
await Promise.all(['black','white'].flatMap(c=>['front','back','sleeve'].map(async side=>{const tx=await loader.loadAsync(`./assets/${c}-${side}.jpg`);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);textures[c+'-'+side]=tx;})));
let color='black',zip=1;const deform=[],cloth=[],ribs=[];
const mat=(texture)=>new T.MeshStandardMaterial({map:texture,roughness:.92,side:T.DoubleSide});
const frontMat=mat(textures['black-front']),backMat=mat(textures['black-back']),sleeveMat=mat(textures['black-sleeve']);
const plain=new T.MeshStandardMaterial({color:0x232426,roughness:.95,side:T.DoubleSide}),rib=plain.clone(),inside=new T.MeshStandardMaterial({color:0x141517,roughness:1,side:T.DoubleSide});
const red=new T.MeshStandardMaterial({color:0x941f23,roughness:.8});
function radius(y){const t=(y+1.1)/2.25;return .72+.13*Math.sin(t*Math.PI*.8)+.04*t;}
function point(a,y,back=false){const r=radius(y);return new T.Vector3(r*Math.sin(a),y,(back?-1:1)*(.29+.025*Math.sin((y+1)*2))*Math.cos(a));}
function panel(back,half){const nx=24,ny=32,g=new T.BufferGeometry(),ps=[],uv=[],ix=[],orig=[];for(let j=0;j<=ny;j++){const v=j/ny,y=-1.1+v*2.22;for(let i=0;i<=nx;i++){const u=i/nx,a=back?(u-.5)*Math.PI:half<0?(-1+u)*Math.PI/2:u*Math.PI/2;const q=point(a,y,back);q.z+=Math.sin(v*40+u*18)*.004;ps.push(q.x,q.y,q.z);orig.push(q.x,q.y,q.z,a);const xNorm=(q.x/radius(y)+1)/2;uv.push(back?1-xNorm:xNorm,v);}}for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*(nx+1)+i;ix.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);}g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();const m=new T.Mesh(g,back?backMat:frontMat);model.add(m);if(!back)deform.push({g,orig,half});}
panel(true,0);panel(false,-1);panel(false,1);
// Dark lining is visible as the front opens.
const lining=new T.Mesh(new T.CylinderGeometry(.69,.65,2.12,64,1,true),inside);lining.scale.z=.36;lining.position.y=-.02;model.add(lining);
function loft(path,rads,material,segments=24){const g=new T.BufferGeometry(),pos=[],uv=[],ind=[];const steps=24;for(let j=0;j<=steps;j++){const t=j/steps,v=path(t),tangent=path(Math.min(1,t+.001)).sub(path(Math.max(0,t-.001))).normalize();let axis=new T.Vector3(0,0,1),other=new T.Vector3().crossVectors(tangent,axis).normalize();for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2,r=rads(t)*(1+.012*Math.sin(j*1.9+k));const q=v.clone().addScaledVector(axis,Math.cos(a)*r*.85).addScaledVector(other,Math.sin(a)*r);pos.push(q.x,q.y,q.z);uv.push(k/segments,1-t);}}for(let j=0;j<steps;j++)for(let k=0;k<segments;k++){const n=j*(segments+1)+k;ind.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);}g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();const mesh=new T.Mesh(g,material);model.add(mesh);return mesh;}
for(const s of [-1,1]){loft(t=>new T.Vector3(s*(.78+.57*t-.05*Math.sin(t*Math.PI)),.94-2*t,-.015+.05*Math.sin(t*Math.PI)),t=>.31-.13*t,sleeveMat);loft(t=>new T.Vector3(s*1.35,-1.06-.22*t,0),()=>.18,rib);}
function oval(y,h,rx,rz,material){const mesh=new T.Mesh(new T.CylinderGeometry(rx,rx,h,80,1,true),material);mesh.scale.z=rz/rx;mesh.position.y=y;model.add(mesh);return mesh;}
oval(-1.14,.19,.735,.295,rib);
const capG=new T.BufferGeometry(),capP=[],capI=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;for(const r of [0,1])capP.push((r?.86:.38)*Math.sin(a),r?1.1:1.08,(r?.3:.29)*Math.cos(a));}for(let i=0;i<64;i++){let n=i*2;capI.push(n,n+1,n+2,n+1,n+3,n+2);}capG.setAttribute('position',new T.Float32BufferAttribute(capP,3));capG.setIndex(capI);capG.computeVertexNormals();model.add(new T.Mesh(capG,plain));
// Shoulder fabric connects the oval neck with the armholes.
loft(t=>new T.Vector3(0,1.07,0),()=>.1,plain);
const collar=new T.Mesh(new T.CylinderGeometry(.36,.39,.3,64,1,true, .065,Math.PI*2-.13),rib);collar.position.set(0,1.22,0);collar.scale.z=.78;model.add(collar);
const stripe=new T.Mesh(new T.CylinderGeometry(.364,.364,.025,64,1,true,.065,Math.PI*2-.13),red);stripe.position.set(0,1.345,0);stripe.scale.z=.78;model.add(stripe);
// Narrow zipper tracks follow the opening edges instead of floating in place.
const zipMat=new T.MeshStandardMaterial({color:0x858585,metalness:.65,roughness:.4});
for(const sign of [-1,1]){const shoulder=new T.Mesh(new T.SphereGeometry(.3,24,16),plain);shoulder.position.set(sign*.77,.89,0);shoulder.scale.set(1,.9,.85);model.add(shoulder);}
const tracks=[];for(const sign of [-1,1]){const arr=[];for(let i=0;i<77;i++){const m=new T.Mesh(new T.BoxGeometry(.018,.019,.014),zipMat);model.add(m);arr.push(m);}tracks.push({sign,arr});}
const pull=new T.Group();const slider=new T.Mesh(new T.BoxGeometry(.07,.09,.04),zipMat);pull.add(slider);const tab=new T.Mesh(new T.BoxGeometry(.038,.13,.018),zipMat);tab.position.set(0,-.08,.025);pull.add(tab);model.add(pull);
function openAt(y){const head=-1.06+zip*2.38;return Math.max(0,(y-head)/(1.4-head+.01))*(1-zip)*.47;}
function updateZip(){for(const {g,orig,half} of deform){const a=g.attributes.position;for(let i=0;i<a.count;i++){const x=orig[i*4],y=orig[i*4+1],z=orig[i*4+2],ang=orig[i*4+3];const f=Math.pow(Math.cos(ang),4),o=openAt(y);a.setXYZ(i,x+half*o*f,y-o*.17*f,z+o*.45*f);}a.needsUpdate=true;g.computeVertexNormals();}for(const {sign,arr} of tracks)arr.forEach((m,i)=>{const y=-1.05+i/76*2.38,o=openAt(y);m.position.set(sign*(.015+o),y-o*.17,.32+o*.45);});pull.position.set(0,-1.05+zip*2.38,.36);collar.rotation.z=(1-zip)*.08;stripe.rotation.z=collar.rotation.z;}
function setColor(c){color=c;frontMat.map=textures[c+'-front'];backMat.map=textures[c+'-back'];sleeveMat.map=textures[c+'-sleeve'];plain.color.set(c==='black'?0x232426:0xe9e3d8);rib.color.copy(plain.color);inside.color.set(c==='black'?0x151618:0xbeb8ac);[frontMat,backMat,sleeveMat].forEach(m=>m.needsUpdate=true);document.querySelectorAll('.swatch').forEach(b=>{b.classList.toggle('active',b.dataset.color===c);b.setAttribute('aria-pressed',b.dataset.color===c);});}
document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>setColor(b.dataset.color)));
document.querySelector('#zip').addEventListener('input',e=>{zip=Number(e.target.value)/100;updateZip();});
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.position.setLength(w/h<.8?9.1:7.8);camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();updateZip();document.querySelector('#loading').remove();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
window.viewer={setColor,get color(){return color},get zip(){return zip},model,controls,renderer};
