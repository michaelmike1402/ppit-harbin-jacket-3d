// The two orthographic mockups share a 864 × 934 pattern space.
// Each sampled row records [body, left sleeve, right sleeve] spans.
const center = 432;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function pointDepth(part, y, t) {
  const radius = part === 0
    ? 68 + 43 * Math.min(1, Math.max(0, (y - 90) / 170)) - 16 * Math.max(0,(y-730)/180)
    : 57 + 19 * Math.exp(-Math.pow((y - 410)/240,2));
  const curve = Math.pow(Math.max(0, 1-t*t), .51);
  const fold = part ? 3.7 * Math.sin(y*.044 + t*3.6) : 2.5 * Math.sin(y*.022+t*9);
  return (radius+fold)*curve;
}

export function garment(profile, zipped) {
  const batches = [];
  const head = profile.pull[0] + (1-zipped)*(885-profile.pull[1]);
  const spread = y => 119 * Math.pow(clamp((head-y)/Math.max(1,head-26),0,1),1.12) * (1-zipped);
  function surface(part, side, half, lining=false) {
    const rows = profile.front, vertices=[], indices=[];
    let last=-1;
    const steps = part ? 18 : 23;
    for(let row=0;row<rows.length;row++) {
      const y=8+5*row, span=rows[row][part];
      if(!span){last=-1;continue;}
      const revPart=part===0?0:3-part;
      const rear=profile.back[row][revPart] || [864-span[1],864-span[0]];
      const offset=vertices.length/5;
      for(let k=0;k<=steps;k++){
        const theta=(half<0 ? -1+k/steps : k/steps)*Math.PI/2;
        const t=Math.sin(theta), frac=(1+t)*.5;
        const mid=part?(span[0]+span[1])*.5:center;
        let x=mid+ t*(t<0 ? mid-span[0] : span[1]-mid);
        const textureX = side>0 ? x : rear[1]-(rear[1]-rear[0])*frac;
        const edgeRound = part
          ? Math.min(1, (span[1]-span[0])/120)
          : Math.min(1, Math.sqrt(Math.max(0,y-9)/45));
        let z=pointDepth(part,y,t)*side*edgeRound;
        // A forward elbow and a wrist that falls slightly back give the sleeve its bend.
        if(part) z+=30*Math.sin((y-190)/710*Math.PI)-8;
        let drop=0;
        if(side>0 && !part){
          const opening=spread(y)*Math.pow(1-Math.abs(t),1.85);
          x+=half*opening;
          z+=.30*opening;
          drop=(.14 + .26*clamp((155-y)/130,0,1))*opening;
        }
        let u=textureX/864, v=y/934;
        if(lining){
          z+=2;
          u=.29+.17*(1-Math.abs(t));
          v=.42+.40*(y/934);
        }
        vertices.push(x-center,467-y-drop,z,u,v);
      }
      if(last>=0) for(let k=0;k<steps;k++)
        indices.push(last+k,offset+k,last+k+1,last+k+1,offset+k,offset+k+1);
      last=offset;
    }
    batches.push({vertices,indices,texture:lining?'front':side>0?'front':'back',tint:lining?.79:1});
  }
  for(const side of [-1,1]) for(const part of [0,1,2]) for(const half of [-1,1])
    surface(part,side,half);
  for(const half of [-1,1]) surface(0,-1,half,true);
  // The pull follows the meeting point of the opening, directly on the front.
  const [top,bottom,hw]=profile.pull, vertices=[];
  for(const dy of [0,bottom-top]) for(const x of [-hw,hw])
    vertices.push(x,467-head-dy,pointDepth(0,head+dy,x/230)+2,(x/hw+1)/2,dy/(bottom-top));
  batches.push({vertices,indices:[0,2,1,1,2,3],texture:'pull',tint:1});
  return batches;
}
