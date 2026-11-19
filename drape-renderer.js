// Shared orthographic projection for GPU and software rendering.
export class DrapeRenderer {
  constructor(canvas) {
    this.canvas=canvas;
    this.gl=canvas.getContext('webgl',{alpha:false,antialias:true});
    if(!this.gl){this.ctx=canvas.getContext('2d');return;}
    const gl=this.gl;
    const shader=(type,source)=>{
      const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec3 position; attribute vec2 uv;
      uniform vec4 view; varying vec2 tex; varying float depth;
      void main(){float z=position.z*view.y-position.x*view.x;
      gl_Position=vec4((position.x*view.y+position.z*view.x)*view.z,position.y*view.w,-z/760.,1.);
      tex=uv;depth=z;}`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;
      varying vec2 tex; varying float depth; uniform sampler2D image; uniform float tint;
      void main(){gl_FragColor=vec4(texture2D(image,tex).rgb*tint,1.);}`));
    gl.linkProgram(program);gl.useProgram(program);
    this.loc={};
    for(const k of ['view','tint'])this.loc[k]=gl.getUniformLocation(program,k);
    for(const k of ['position','uv'])this.loc[k]=gl.getAttribLocation(program,k);
    this.vbo=gl.createBuffer();this.ibo=gl.createBuffer();this.textures=new WeakMap();
    gl.enable(gl.DEPTH_TEST);gl.clearColor(238/255,238/255,236/255,1);
  }
  setMesh(batches){
    this.batches=batches.map(b=>({...b,vertices:new Float32Array(b.vertices),indices:new Uint16Array(b.indices)}));
    if(!this.gl)return;
    const gl=this.gl,vertices=[],indices=[];
    for(const b of this.batches){
      const offset=vertices.length/5;b.start=indices.length*2;
      for(const value of b.vertices)vertices.push(value);
      for(const index of b.indices)indices.push(offset+index);
    }
    if(vertices.length/5>=65536)throw Error('Index capacity exceeded');
    gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.DYNAMIC_DRAW);
    for(const [name,n,off] of [['position',3,0],['uv',2,12]]){
      gl.enableVertexAttribArray(this.loc[name]);gl.vertexAttribPointer(this.loc[name],n,gl.FLOAT,false,20,off);
    }
  }
  draw(images,angle){
    const canvas=this.canvas,gl=this.gl,ratio=Math.min(devicePixelRatio,gl?2:1.25);
    const w=Math.round(canvas.clientWidth*ratio),h=Math.round(canvas.clientHeight*ratio);
    if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;}
    const scale=(this.zoom || 1)*Math.min(w*.91/864,(h-Math.min(165*ratio,h*.23))/944);
    const s=Math.sin(angle),c=Math.cos(angle);
    if(!gl){this.software(images,s,c,scale,w,h);return;}
    gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform4f(this.loc.view,s,c,2*scale/w,2*scale/h);
    for(const b of this.batches){
      const image=images[b.texture];
      let texture=this.textures.get(image);
      if(!texture){
        texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
        for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
        this.textures.set(image,texture);
      }
      gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1f(this.loc.tint,b.tint);
      gl.drawElements(gl.TRIANGLES,b.indices.length,gl.UNSIGNED_SHORT,b.start);
    }
  }
  software(images,s,c,scale,w,h){
    const frame=this.ctx.createImageData(w,h),pixels=new Uint32Array(frame.data.buffer);
    pixels.fill(0xffeceeee);
    const depth=new Float32Array(w*h);depth.fill(-Infinity);
    for(const b of this.batches){
      const img=images[b.texture];
      if(!img.pixels){
        const buf=document.createElement('canvas');buf.width=img.width;buf.height=img.height;
        const ctx=buf.getContext('2d');ctx.drawImage(img,0,0);
        img.pixels=new Uint32Array(ctx.getImageData(0,0,img.width,img.height).data.buffer);
      }
      const v=b.vertices.slice();
      for(let i=0;i<v.length;i+=5){
        const x=v[i],z=v[i+2];v[i]=w/2+(x*c+z*s)*scale;v[i+1]=h/2-v[i+1]*scale;v[i+2]=z*c-x*s;
      }
      for(let i=0;i<b.indices.length;i+=3){
        const a=b.indices[i]*5,j=b.indices[i+1]*5,k=b.indices[i+2]*5;
        const ax=v[a],ay=v[a+1],bx=v[j]-ax,by=v[j+1]-ay,cx=v[k]-ax,cy=v[k+1]-ay;
        const area=bx*cy-by*cx;if(Math.abs(area)<.0001)continue;
        const xmin=Math.max(0,Math.floor(ax+Math.min(0,bx,cx))),xmax=Math.min(w-1,Math.ceil(ax+Math.max(0,bx,cx)));
        const ymin=Math.max(0,Math.floor(ay+Math.min(0,by,cy))),ymax=Math.min(h-1,Math.ceil(ay+Math.max(0,by,cy)));
        for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
          const dx=x+.5-ax,dy=y+.5-ay,p=(dx*cy-dy*cx)/area,q=(dy*bx-dx*by)/area,r=1-p-q;
          if(Math.min(r,p,q)<-.00001)continue;
          const z=r*v[a+2]+p*v[j+2]+q*v[k+2],idx=y*w+x;
          if(z<=depth[idx])continue;depth[idx]=z;
          const u=Math.min(img.width-1,Math.max(0,Math.floor((r*v[a+3]+p*v[j+3]+q*v[k+3])*img.width)));
          const t=Math.min(img.height-1,Math.max(0,Math.floor((r*v[a+4]+p*v[j+4]+q*v[k+4])*img.height)));
          const col=img.pixels[t*img.width+u];
          pixels[idx]=b.tint===1?col:0xff000000|((col&255)*b.tint)|((((col>>>8)&255)*b.tint)<<8)|((((col>>>16)&255)*b.tint)<<16);
        }
      }
    }
    this.ctx.putImageData(frame,0,0);
  }
}
