/* Authored architectural campus and case-driven transfer lanes. No external stock assets. */
(() => {
  const {T,group,box,object,mat,board,line,inverter,crate,bench,monitor,person,van,sphere,cylinder}=globalThis.ServiceCampusKit;
  const orange='#ff7900', charcoal='#263940', white='#edf0ec';
  let seed=731;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const steel=new T.MeshStandardMaterial({color:'#89999c',metalness:.65,roughness:.34});
  const glazing=new T.MeshPhysicalMaterial({color:'#739aaa',metalness:.42,roughness:.16,transparent:true,opacity:.80,clearcoat:1});
  const panelMaterial=new T.MeshStandardMaterial({color:'#183345',metalness:.52,roughness:.23});
  function grainTexture(base,amount=20) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d'),data=ctx.createImageData(256,256);
    for(let i=0;i<data.data.length;i+=4){const n=(rand()-.5)*amount;data.data[i]=base[0]+n;data.data[i+1]=base[1]+n;data.data[i+2]=base[2]+n;data.data[i+3]=255;}
    ctx.putImageData(data,0,0);const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;return texture;
  }
  const grassTexture=grainTexture([125,151,117],14);grassTexture.repeat.set(110,110);
  const grassMaterial=new T.MeshStandardMaterial({map:grassTexture,roughness:1,color:'#dce6d5'});
  const roadTexture=grainTexture([99,109,112],17);roadTexture.repeat.set(20,3);
  const roadMaterial=new T.MeshStandardMaterial({map:roadTexture,color:'#a5b7c3',roughness:.95});
  function surface(parent,w,h,d,x,y,z,material) { const m=box(parent,white,x,y,z,w,h,d,true);m.material=material;return m; }
  function rod(parent,a,b,r,color) {
    const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start);
    const mesh=object(parent,new T.CylinderGeometry(r,r,dir.length(),8),color,...start.clone().add(end).multiplyScalar(.5).toArray(),1,1,1,true);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());return mesh;
  }
  function technician(parent,x,z,pose,phase=0) {
    const actor=group(parent,x,0,z);actor.rotation.y=Math.PI;
    const shirt=phase%2?'#42616e':orange,skin='#bf8e6f';
    const hips=group(actor,0,.82,0);
    object(hips,new T.CapsuleGeometry(.16,.12,4,10),'#3a4e58',0,0,0,1.25,1,.73,true);
    const body=group(actor,0,1.1,0);
    object(body,new T.CylinderGeometry(.20,.155,.44,14),shirt,0,0,0,1.22,1,.72,true);
    object(body,new T.CylinderGeometry(.084,.07,.07,12),skin,0,.25,0,1,1,1,true);
    box(body,'#e0e5d8',0,-.09,.14,.34,.032,.014);
    box(body,'#e7eadb',-.10,.09,.144,.07,.055,.008);
    const head=group(body,0,.43,0);
    object(head,sphere,skin,0,0,0,.14,.19,.14,true);
    for(const side of [-1,1])object(head,sphere,skin,side*.14,0,0,.028,.047,.035);
    object(head,sphere,'#e7ece1',0,.11,-.006,.16,.095,.16,true);
    box(head,'#e7ece1',0,.077,.10,.31,.025,.20);
    object(head,sphere,skin,0,-.015,.14,.028,.035,.035);
    const arms=[],legs=[];
    for(const side of [-1,1]){
      const shoulder=group(body,side*.245,.12,0);
      object(shoulder,new T.CapsuleGeometry(.075,.12,4,10),shirt,0,-.10,0,1,1,1,true);
      const elbow=group(shoulder,0,-.23,0);
      object(elbow,new T.CapsuleGeometry(.053,.14,4,10),skin,0,-.10,0,1,1,1,true);
      object(elbow,sphere,'#d2d8cc',0,-.24,0,.057,.073,.053,true);
      if(side===1&&pose==='repair')rod(elbow,[0,-.25,0],[0,-.43,.025],.014,'#9bacb1');
      if(side===1&&pose==='scan')box(elbow,'#324e5b',0,-.24,.05,.075,.13,.065);
      arms.push({shoulder,elbow});
      const leg=group(hips,side*.11,-.06,0);
      legs.push(leg);
      object(leg,new T.CapsuleGeometry(.075,.24,4,10),'#3b505b',0,-.20,0,1,1,1,true);
      object(leg,new T.CapsuleGeometry(.061,.24,4,10),'#344852',0,-.52,0,1,1,1,true);
      box(leg,'#25343d',0,-.71,.045,.145,.115,.25,true);
    }
    return {actor,update(t){
      const movement=Math.sin(t*2.5+phase),repair=pose==='repair';
      body.rotation.x=.12+movement*(repair?.05:.025);
      body.rotation.y=repair?Math.sin(t*.9+phase)*.07:0;
      head.rotation.y=Math.sin(t*.8+phase)*.10;
      if(pose==='push')legs.forEach((leg,i)=>leg.rotation.x=Math.sin(t*5+phase+i*Math.PI)*.28);
      arms.forEach(({shoulder,elbow},i)=>{
        shoulder.rotation.x=(repair?-1.2:-.9)+Math.sin(t*(repair?2.6:1.6)+phase+i)*(repair?.12:.15);
        shoulder.rotation.z=(i?1:-1)*(.08+Math.sin(t*1.3+phase)*.06);
        elbow.rotation.x=(repair?-1.0:-.8)+Math.sin(t*(repair?4.2:2)+phase+i)*(repair?.15:.18);
      });
    }};
  }
  function fleetVan(root,x,y,z,angle,loading=false) {
    const g=van(root,x,y,z,angle,loading);
    if(loading){g.userData.loadingParts=g.children.slice(-4);const tailgate=box(g,white,0,.86,-1.51,1.20,1.12,.04);tailgate.visible=false;g.userData.tailgate=tailgate;}
    for(const side of [-1,1]){
      surface(g,.015,.35,.51,side*.702,.95,.91,glazing);
      box(g,'#668089',side*.71,.62,.80,.025,.055,.14);
      rod(g,[side*.72,.88,1.12],[side*.91,.95,1.16],.018,'#3d535d');
      box(g,'#344f59',side*.94,.99,1.16,.08,.17,.13);
      for(const zz of [-.99,.99]){const rim=object(g,cylinder,'#acb8b8',side*.82,.26,zz,.13,.012,.13);rim.rotation.z=Math.PI/2;}
      for(let zz=-1.2;zz<.5;zz+=.55)box(g,'#d0d9d4',side*.706,1.03,zz,.012,.96,.014);
    }
    box(g,'#41565f',0,.40,1.50,1.15,.10,.04);
    box(g,'#e8ebdf',0,.45,1.53,.35,.08,.015);
    return g;
  }
  function panel(parent,x,y,z,w=2.1,d=3.3,tilt=-.18) {
    const p=group(parent,x,y,z);p.rotation.x=tilt;
    surface(p,w+.08,.10,d+.08,0,0,0,steel);
    surface(p,w,.025,d,0,.065,0,panelMaterial);
    for(let i=1;i<6;i++)box(p,'#73929f',-w/2+i*w/6,.08,0,.012,.006,d);
    for(let i=1;i<11;i++)box(p,'#73929f',0,.08,-d/2+i*d/11,w,.006,.012);
    return p;
  }
  const crossStreets = { x: [-24, 25], z: [-21, 12] };
  const roadHalfWidth = 2.8;
  const dockX = [-16, 16];
  const dockHalfWidth = 2.25;
  const dockRampStart = 7.75;
  const dockBayStart = 4.5;
  const dockRampEnd = 12 - roadHalfWidth;
  const dockDeckHeight = .22;
  const roadSurfaceHeight = -.07;

  function dockHeight(z) {
    const progress = T.MathUtils.clamp((z - dockRampStart) / (dockRampEnd - dockRampStart), 0, 1);
    return T.MathUtils.lerp(dockDeckHeight, roadSurfaceHeight, progress);
  }

  function addDockRamp(root, x) {
    const length = dockRampEnd - dockRampStart;
    const rise = dockDeckHeight - roadSurfaceHeight;
    const geometry = new T.PlaneGeometry(dockHalfWidth * 2, Math.hypot(length, rise));
    geometry.rotateX(-Math.PI / 2 + Math.atan2(rise, length));
    const ramp = new T.Mesh(geometry, roadMaterial);
    ramp.position.set(x, (dockDeckHeight + roadSurfaceHeight) / 2, (dockRampStart + dockRampEnd) / 2);
    ramp.receiveShadow = true;
    root.add(ramp);
  }

  function road(root,x,z,w,d) {
    const horizontal = w > d;
    const length = horizontal ? w : d;
    const center = horizontal ? x : z;
    const crossings = horizontal ? crossStreets.x : crossStreets.z;
    const intersections = crossings.map(at => [at-roadHalfWidth, at+roadHalfWidth]);
    const segments = gaps => {
      let start = center-length/2;
      const spans = [];
      for (const [left,right] of gaps.sort((a,b)=>a[0]-b[0])) {
        if (left > start) spans.push([start,left]);
        start = Math.max(right,start);
      }
      spans.push([start,center+length/2]);
      return spans;
    };
    const strip = (a,b,offset,y,thickness,width,color) =>
      box(root,color,horizontal?(a+b)/2:x+offset,y,horizontal?z+offset:(a+b)/2,
        horizontal?b-a:width,thickness,horizontal?width:b-a);
    // The avenue owns the intersection surface; the cross street ends flush at its edge.
    for (const [a,b] of segments(horizontal?[]:intersections)) {
      strip(a,b,0,-.12,.10,horizontal?d:w,'#39474d').material=roadMaterial;
    }
    for (let at=center-length/2+1; at<center+length/2-.7; at+=3.2) {
      if (!intersections.some(([a,b])=>at+.7>=a&&at-.7<=b)) {
        strip(at-.7,at+.7,0,-.061,.009,.07,'#d6d9cc');
      }
    }
    for (const side of [-1,1]) {
      const gaps = crossings.map(at=>[at-roadHalfWidth-.675,at+roadHalfWidth+.675]);
      if(horizontal && z===12 && side===-1) {
        gaps.push(...dockX.map(at=>[at-dockHalfWidth,at+dockHalfWidth]));
      }
      for (const [a,b] of segments(gaps)) {
        strip(a,b,side*(roadHalfWidth+.35),-.08,.16,.65,'#d2d5c9');
      }
    }
  }
  function turbine(root,x,z,height=12) {
    const g=group(root,x,0,z);
    object(g,new T.CylinderGeometry(.19,.48,height,24),'#e4e9e5',0,height/2,0,1,1,1,true);
    box(g,'#e6eae6',0,height,-.4,.9,.7,1.9,true);
    const rotor=group(g,0,height,.65);
    object(rotor,sphere,'#eff2ed',0,0,0,.43,.43,.49,true);
    const outline=new T.Shape();outline.moveTo(-.13,.32);outline.bezierCurveTo(-.38,.7,-.43,1.4,-.27,2.2);outline.bezierCurveTo(-.13,3.15,.14,4.9,.23,5.35);outline.bezierCurveTo(.31,5.43,.33,5.22,.31,4.94);outline.bezierCurveTo(.20,2.6,.29,1.1,.16,.32);outline.closePath();
    const geometry=new T.ExtrudeGeometry(outline,{depth:.07,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:2,steps:1,curveSegments:12});
    for(let k=0;k<3;k++){const blade=new T.Mesh(geometry,mat('#eaf0e8'));blade.rotation.z=k*Math.PI*2/3;blade.castShadow=true;rotor.add(blade);}
    return rotor;
  }
  function woodland(root,trees) {
    // Small individual leaf facets give the canopy a broken, botanical silhouette.
    const vertices=[],normals=[];
    for(let i=0;i<46;i++){
      const center=new T.Vector3((rand()-.5)*1.7,(rand()-.5)*1.6,(rand()-.5)*1.7);
      const normal=new T.Vector3(rand()-.5,.3+rand(),rand()-.5).normalize();
      const u=new T.Vector3().crossVectors(normal,new T.Vector3(0,0,1)).normalize().multiplyScalar(.17+rand()*.13);
      const v=new T.Vector3().crossVectors(normal,u).normalize().multiplyScalar(.10+rand()*.10);
      const points=[center.clone().add(u),center.clone().add(v),center.clone().sub(u),center.clone().sub(v)];
      for(const j of [0,1,2,0,2,3]){vertices.push(...points[j].toArray());normals.push(...normal.toArray());}
    }
    const foliageGeo=new T.BufferGeometry();foliageGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));foliageGeo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    const foliage=new T.InstancedMesh(foliageGeo,new T.MeshStandardMaterial({color:'#ffffff',roughness:.9,side:T.DoubleSide}),trees.length*36);
    const bark=new T.InstancedMesh(new T.CylinderGeometry(.06,.12,1,7),mat('#716650'),trees.length*4);
    const helper=new T.Object3D(),leaves=[];let leafIndex=0,barkIndex=0;
    const colors=['#41663d','#587b42','#6d8748','#365f3a','#829750'];
    for(const [x,z,s=1] of trees){
      helper.position.set(x,s*1.3,z);helper.scale.set(s,s*2.6,s);helper.rotation.set(0,0,0);helper.updateMatrix();bark.setMatrixAt(barkIndex++,helper.matrix);
      for(let branch=0;branch<3;branch++){const angle=branch*2.094;helper.position.set(x+Math.cos(angle)*.36*s,2.1*s,z+Math.sin(angle)*.36*s);helper.scale.set(s*.65,s*1.4,s*.65);helper.rotation.set(Math.sin(angle)*.55,0,-Math.cos(angle)*.55);helper.updateMatrix();bark.setMatrixAt(barkIndex++,helper.matrix);}
      for(let j=0;j<36;j++){
        const angle=rand()*Math.PI*2,r=Math.sqrt(rand())*1.25*s,yy=2.65*s+(rand()-.5)*1.4*s;
        const pos=[x+Math.cos(angle)*r,yy,z+Math.sin(angle)*r],size=(.30+rand()*.35)*s;
        helper.position.set(...pos);helper.scale.set(size,size*.85,size);helper.rotation.set(rand(),rand(),rand());helper.updateMatrix();foliage.setMatrixAt(leafIndex,helper.matrix);foliage.setColorAt(leafIndex,new T.Color(colors[j%5]));leaves.push({pos,size,phase:rand()*6});leafIndex++;
      }
    }
    foliage.castShadow=true;foliage.receiveShadow=true;bark.castShadow=true;root.add(foliage,bark);
    return t=>{leaves.forEach(({pos,size,phase},i)=>{helper.position.set(pos[0]+Math.sin(t*.7+phase)*.035,pos[1],pos[2]);helper.scale.set(size,size*.85,size);helper.rotation.set(0,phase,0);helper.updateMatrix();foliage.setMatrixAt(i,helper.matrix);});foliage.instanceMatrix.needsUpdate=true;};
  }
  // White ceramic fins and recessed blue curtain wall, inspired by the supplied HQ photos.
  function office(root,x,z,w,d,h) {
    const g=group(root,x,0,z);
    box(g,'#cbdce5',0,h/2,0,w,h,d,true);
    const facade=new T.MeshPhysicalMaterial({color:'#7399b3',metalness:.55,roughness:.19,clearcoat:1});
    for(const side of [-1,1]){
      surface(g,w-.18,h-.2,.06,0,h/2,side*(d/2+.02),facade);
      surface(g,.06,h-.2,d-.18,side*(w/2+.02),h/2,0,facade);
      for(let xx=-w/2+.2;xx<w/2;xx+=.48)box(g,'#edf3f6',xx,h/2,side*(d/2+.12),.075,h,.22);
      for(let zz=-d/2+.2;zz<d/2;zz+=.48)box(g,'#e4eef2',side*(w/2+.12),h/2,zz,.22,h,.075);
      for(let yy=1;yy<h;yy+=.85){box(g,'#a2bac9',0,yy,side*(d/2+.06),w,.035,.03);box(g,'#a2bac9',side*(w/2+.06),yy,0,.03,.035,d);}
    }
    box(g,'#eff4f5',0,h+.10,0,w+.25,.20,d+.25,true);
    box(g,'#bacbd3',0,h+.25,0,w*.65,.20,d*.65);
    // Glazed entrance, canopy and plinth remain physically attached to the facade.
    box(g,'#eef3f4',0,.06,d/2+1.2,w+1,.16,2.4,true);
    surface(g,2,1.8,.12,0,.95,d/2+.22,facade);
    box(g,'#f1f4f3',0,2.1,d/2+.8,3.3,.16,1.5,true);
    for(const xx of [-1.45,1.45])box(g,'#b2c6cd',xx,1.03,d/2+1.35,.06,2.05,.06);
    if(h>13){board(g,'SUNGROW',w*.12,h-1,d/2+.28,w*.65,.65,'#ff7900','rgba(255,255,255,0)');for(let yy=3;yy<h-2;yy+=4)box(g,'#eef3f5',-w/2-.25,yy,d/2-.5,.65,2.8,2.0,true);}
  }
  function productGallery(root) {
    const yard=group(root,39,0,3);
    box(yard,'#d4dfe4',0,.03,0,15,.20,7,true);
    const enamel=new T.MeshPhysicalMaterial({color:'#f2f4f3',metalness:.22,roughness:.32,clearcoat:.55});
    function screw(g,x,y,z){object(g,sphere,'#859094',x,y,z,.014,.014,.009);}
    function stop(g,x,y,z){const base=object(g,cylinder,'#f6c932',x,y,z,.065,.025,.065);base.rotation.x=Math.PI/2;const red=object(g,cylinder,'#d63b26',x,y,z+.024,.043,.035,.043);red.rotation.x=Math.PI/2;}
    function handle(g,x,y,z){for(const yy of [-.12,.12])box(g,'#a6afb1',x,y+yy,z,.03,.025,.055);rod(g,[x,y-.12,z+.03],[x,y+.12,z+.03],.018,'#d1d8d9');}
    const stack=group(yard,-4.2,.14,0);stack.name='PowerStack / dimensional product model';
    box(stack,'#424a4f',0,.10,0,1.15,.20,1.61,true);
    surface(stack,1.15,2.18,1.61,0,1.29,0,enamel);
    box(stack,'#3f484c',0,2.42,0,1.15,.08,1.61,true);
    box(stack,orange,0,2.36,.812,.92,.045,.015);
    surface(stack,1.06,2.10,.025,0,1.27,.816,enamel);
    box(stack,'#333d42',0,1.91,.838,.88,.49,.018);
    // Repeated hexagonal perforations have depth and do not rotate with the camera.
    const grilleGeo=new T.RingGeometry(.022,.031,6),grilleMat=mat('#e9edec');
    for(let row=0;row<8;row++)for(let col=0;col<15;col++){const hex=new T.Mesh(grilleGeo,grilleMat);hex.position.set(-.405+col*.055+(row%2)*.027,1.70+row*.058,.852);stack.add(hex);}
    for(let i=0;i<6;i++)box(stack,'#37b9df',-.14+i*.055,2.20,.847,.032,.018,.015,false,true);
    board(stack,'SUNGROW',0,2.27,.848,.53,.085,'#41474b','rgba(0,0,0,0)');
    stop(stack,0,1.32,.85);handle(stack,-.45,.95,.85);
    surface(stack,.018,.87,1.02,.583,1.72,-.06,enamel);
    for(const yy of [1.3,2.13])for(const zz of [-.53,.41])screw(stack,.594,yy,zz);
    for(const xx of [-.45,.45])for(const zz of [-.66,.66]){const eye=new T.Mesh(new T.TorusGeometry(.035,.008,6,16),steel);eye.position.set(xx,2.50,zz);stack.add(eye);}
    for(const xx of [-.32,.32])box(stack,'#1f292e',xx,.07,.812,.16,.09,.012);
    const titan=group(yard,1.9,.14,0);titan.name='PowerTitan / dimensional product model';
    box(titan,'#3a4248',0,.12,0,6.1,.24,2.44,true);
    surface(titan,6.1,2.45,2.44,0,1.46,0,enamel);
    box(titan,'#343d42',0,2.72,0,6.1,.10,2.44,true);
    box(titan,orange,0,2.65,1.232,5.75,.035,.012);
    for(let i=0;i<6;i++){const x=-2.52+i*1.01;surface(titan,.985,2.34,.035,x,1.46,1.235,enamel);handle(titan,x-.38,1.39,1.265);for(const yy of [.4,2.5])screw(titan,x+.42,yy,1.264);}
    board(titan,'SUNGROW',-2.52,2.39,1.27,.65,.10,'#41474b','rgba(0,0,0,0)');
    for(let i=0;i<6;i++)box(titan,'#37b9df',-2.68+i*.055,2.24,1.273,.03,.015,.01,false,true);
    stop(titan,-2.52,1.87,1.28);
    for(const side of [-1,1]){surface(titan,.025,1.86,2.21,side*3.065,1.56,0,enamel);for(let i=0;i<16;i++)box(titan,'#7e898e',side*3.084,.48+i*.024,.45,.015,.012,.63);for(const zz of [-1.08,1.08])for(const yy of [.3,2.5])box(titan,'#8d989c',side*3.08,yy,zz,.025,.07,.07);}
    for(let z=-1.1;z<=1.1;z+=.11)box(titan,'#576168',0,2.78,z,5.9,.025,.035);
    for(const [x,text,width]of [[-4.2,'PowerStack',1.3],[1.9,'PowerTitan',2.1]]){box(yard,'#334f5c',x,.32,2.5,width,.42,.10,true);board(yard,text,x,.33,2.558,width-.1,.22,'#ffffff','#334f5c');}
  }
  function landscaping(root) {
    box(root,'#8c9e75',0,-.48,0,220,.55,220,true).material=grassMaterial;
    road(root,0,12,130,5.6);road(root,-24,-10,5.6,100);road(root,25,-10,5.6,100);road(root,0,-21,130,5.6);
    // Bound the site base by the inner edges of all four carriageways.
    const [westStreet, eastStreet] = crossStreets.x;
    const [northStreet, southStreet] = crossStreets.z;
    const siteWest = westStreet + roadHalfWidth;
    const siteEast = eastStreet - roadHalfWidth;
    const siteNorth = northStreet + roadHalfWidth;
    const siteSouth = southStreet - roadHalfWidth;
    const siteThickness = .20;
    box(root, '#b8c2b2', (siteWest + siteEast) / 2, roadSurfaceHeight - siteThickness / 2,
      (siteNorth + siteSouth) / 2, siteEast - siteWest, siteThickness, siteSouth - siteNorth);
    const trees=[];
    for(let x=-48;x<55;x+=4.2){if(Math.abs(x+24)<5||Math.abs(x-25)<5)continue;trees.push([x,16,.9+rand()*.35],[x,-25,.8+rand()*.3]);}
    for(let z=-54;z<42;z+=4.6){if(Math.abs(z-12)<5||Math.abs(z+21)<5)continue;trees.push([-28,z,.95+rand()*.35],[29,z,.8+rand()*.3]);}
    // Mixed landscaped clusters, set back from carriageways and the service apron.
    for(let i=0;i<38;i++)trees.push([-41+(rand()-.5)*13,-4+(rand()-.5)*21,.8+rand()*.6]);
    for(let i=0;i<18;i++)trees.push([39+(rand()-.5)*15,23+rand()*9,.7+rand()*.4]);
    office(root,-12,-35,11,8,5.4);office(root,3,-37,9,8,13.8);office(root,14,-35,7,8,7.2);
    // Low-rise research buildings with terraces and deep window reveals.
    for(const [x,z]of [[-37,22],[-48,22],[-37,34]]){office(root,x,z,7,5,3.7);box(root,'#e0d8c5',x,0,z+4,8,.15,2.8);for(const sx of [-2.5,2.5])box(root,white,x+sx,1.5,z+3,.14,3,.14);box(root,white,x,3.03,z+3,7,.15,2.1);}
    const rotors=[turbine(root,-37,-29,13),turbine(root,19,-28,14),turbine(root,51,-44,15)];
    for(let row=0;row<3;row++)for(let col=0;col<5;col++){
      const x=34+col*3.3,z=-15+row*4.5;
      panel(root,x,.85,z,2.7,3.6);
      for(const side of [-1,1])for(const end of [-1,1])rod(root,[x+side,0,z+end],[x+side,.85+end*.18,z+end],.045,'#89999a');
    }
    const animateTrees=woodland(root,trees);
    const cars=[fleetVan(root,-25.25,-.065,0,0),fleetVan(root,26.25,-.065,0,Math.PI),fleetVan(root,0,-.065,13.25,Math.PI/2),fleetVan(root,0,-.065,-22.25,-Math.PI/2)];
    return t=>{animateTrees(t);rotors.forEach((r,i)=>r.rotation.z=t*(.26+i*.025));cars[0].position.z=(t*1.7+47)%100-60;cars[1].position.z=40-(t*1.5+21)%100;cars[2].position.x=(t*1.7+24)%130-65;cars[3].position.x=65-(t*1.4+50)%130;};
  }
  function floatingSolar(root) {
    const lake=group(root,2,-.12,31);
    lake.scale.x=.92;
    const shape=new T.Shape();shape.moveTo(-18,-6);shape.bezierCurveTo(-20,-15,-8,-17,7,-14);shape.bezierCurveTo(20,-14,24,-4,19,7);shape.bezierCurveTo(15,17,-12,17,-18,6);shape.quadraticCurveTo(-21,0,-18,-6);
    const shore=new T.Mesh(new T.ShapeGeometry(shape,80),mat('#b6b69a'));shore.rotation.x=-Math.PI/2;shore.scale.setScalar(1.045);lake.add(shore);
    const waterGeo=new T.ShapeGeometry(shape,80);
    const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=256;const ctx=normalCanvas.getContext('2d'),image=ctx.createImageData(256,256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4;image.data[i]=128+26*Math.cos(x*.29+y*.07)+12*Math.sin(y*.35);image.data[i+1]=128+22*Math.sin(y*.25+x*.1);image.data[i+2]=245;image.data[i+3]=255;}ctx.putImageData(image,0,0);
    const normals=new T.CanvasTexture(normalCanvas);normals.wrapS=normals.wrapT=T.RepeatWrapping;normals.repeat.set(.42,.42);
    const waterMat=new T.MeshPhysicalMaterial({color:'#488eaa',metalness:.3,roughness:.18,clearcoat:1,normalMap:normals,normalScale:new T.Vector2(.20,.20),transparent:true,opacity:.96});
    const water=new T.Mesh(waterGeo,waterMat);water.rotation.x=-Math.PI/2;water.position.y=.025;water.receiveShadow=true;lake.add(water);
    const bankTrees=[];
    const edge=shape.getPoints(75);
    edge.forEach((p,i)=>{if(i%3)return;const x=p.x*1.04,z=-p.y*1.04;
      if(x>19||Math.abs(x+11)<1.3&&z<0)return;
      const rockGeo=new T.IcosahedronGeometry(1,0);const rock=object(lake,rockGeo,i%2?'#6b7568':'#8c9481',x,.04,z,.25+rand()*.55,.10+rand()*.2,.35+rand()*.5,true);rock.rotation.set(rand()*.3,rand()*3,rand()*.3);
      for(let k=0;k<5;k++){const g=group(lake,x+(rand()-.5)*.6,.12,z+(rand()-.5)*.6);for(let blade=0;blade<3;blade++){const leaf=new T.Mesh(new T.ConeGeometry(.035,.5+rand()*.35,3),mat('#6a8250'));leaf.position.y=.2;leaf.rotation.z=(rand()-.5)*.6;g.add(leaf);}}
      if(i%12===0&&z>0&&x<17)bankTrees.push([x*1.13,z*1.13,.8+rand()*.3]);
    });
    const animateBank=woodland(lake,bankTrees);
    const arrays=[];
    for(let row=0;row<3;row++){
      const raft=group(lake,-9,.20,-6+row*5);arrays.push(raft);
      for(let col=0;col<6;col++){
        const x=col*3.1;
        for(const side of [-1,1])box(raft,'#a3b4ad',x+side*1.05,.10,0,.42,.34,3.6,true);
        box(raft,'#687c7d',x,.15,0,2.75,.14,3.5);
        panel(raft,x,.65,0,2.65,3.4,-.16);
        for(const side of [-1,1])for(const end of [-1,1])rod(raft,[x+side,.25,end],[x+side,.65+end*.16,end],.035,'#93a7a4');
      }
      box(raft,'#aab6b0',7.7,.22,2.1,19,.15,.7,true);
      for(let x=-1;x<18;x+=.8)box(raft,'#677c7c',x,.30,2.1,.025,.012,.65);
    }
    box(lake,'#a3b1a8',-11,.27,-.5,.9,.2,16,true);
    for(const [a,b]of [[[-16,-10],[-10,-7]],[[17,-10],[9,-7]],[[17,10],[9,6]],[[-16,10],[-10,6]]]){
      box(lake,'#89988b',a[0],.12,a[1],.6,.2,.6);
      const cable=new T.CatmullRomCurve3([new T.Vector3(a[0],.2,a[1]),new T.Vector3((a[0]+b[0])/2,.07,(a[1]+b[1])/2),new T.Vector3(b[0],.22,b[1])]);
      lake.add(new T.Mesh(new T.TubeGeometry(cable,12,.016,5,false),mat('#465c59')));
    }
    box(lake,'#a5b4aa',-11,.40,-11,.9,.2,6.3,true);
    for(const side of [-1,1]){
      rod(lake,[-11+side*.48,.8,-14],[-11+side*.48,.8,-8],.025,'#cbd3ca');
      for(let z=-14;z<-8;z+=1.5)rod(lake,[-11+side*.48,.35,z],[-11+side*.48,.8,z],.022,'#cbd3ca');
    }
    const rippleMaterial=new T.MeshBasicMaterial({color:'#c5e0d7',transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false});
    const ripples=[];for(let i=0;i<16;i++){const r=new T.Mesh(new T.RingGeometry(.7, .715,48,1,0,Math.PI*1.5),rippleMaterial);r.rotation.x=-Math.PI/2;r.position.set(-16+rand()*33,.055,-10+rand()*20);r.scale.set(1,.4,1);lake.add(r);ripples.push(r);}
    return t=>{animateBank(t);normals.offset.set(t*.004,t*.002);arrays.forEach((raft,i)=>{raft.position.y=.20+Math.sin(t*.7+i)*.018;raft.rotation.z=Math.sin(t*.5+i)*.0015;});ripples.forEach((r,i)=>{r.rotation.z=t*.015+i;r.scale.setScalar(.8+(Math.sin(t*.4+i)+1)*.35);});};
  }
  function buildWorld(scene) {
    seed=731;
    const root=group(scene),hitGroups=[],markers=new Map(),rings=new Map(),crew=[];
    const animateLandscape=landscaping(root),animateLake=floatingSolar(root);
    let workload={},previousTime=0;const clocks={};
    const stageIds=['receive','repair','test','handover'];
    const stageX={receive:-13.5,repair:-4.5,test:4.5,handover:13.5};
    // Four parallel work cells, connected by a dedicated, unobstructed transfer aisle.
    box(root,'#bec9c8',0,-.02,-4,39,.28,22,true);
    box(root,'#dce2df',0,.13,-4,38,.10,21,true);
    for(let x=-18;x<=18;x+=3)for(let z=-13;z<7;z+=3){box(root,'#c5d0cb',x,.19,z,.015,.008,3);box(root,'#c5d0cb',x+1.5,.19,z+1.5,3,.008,.015);}
    // Rear glazing and structural canopy; front cut away for process visibility.
    box(root,'#e8ece7',0,2.35,-14.2,38,4.6,.26,true);
    for(let x=-18;x<19;x+=3){surface(root,2.7,2.1,.08,x,2.8,-14.02,glazing);box(root,'#4f686e',x-1.4,2.4,-13.96,.07,4.5,.12);}
    box(root,'#f0f1e9',0,4.8,-12.7,39,.26,3.3,true);
    box(root,orange,0,4.65,-11.0,39,.09,.12);
    for(const x of [-18.5,-9,0,9,18.5]){surface(root,.19,4.7,.22,x,2.4,-11.05,steel);box(root,'#6c7c7c',x,.35,-11.05,.35,.5,.38);}
    board(root,'SUNGROW  /  SERVICE CENTER',0,4.38,-10.85,8,.48,'#ff7900','#edf0e9');
    for(let x=-16;x<=16;x+=2.5)panel(root,x,5.04,-12.9,2.05,2.6,-.08);
    for(const x of [-19.1,19.1]){
      box(root,'#edf3f5',x,2.35,-4.2,.30,4.6,19.7,true);
      surface(root,.05,2.3,15.4,x+(x<0?.18:-.18),2.65,-5.2,glazing);
      box(root,'#eef4f5',x,4.80,-4.3,.65,.32,20.2,true);
      for(let z=-12;z<5;z+=2.8)box(root,'#b4c8d0',x,2.4,z,.36,4.5,.055);
    }
    // Rear roof has a restrained, rounded fascia. The cutaway is intentionally open.
    box(root,'#f1f5f6',0,4.96,-11.3,39.5,.48,.65,true);
    for(const [i,id]of stageIds.entries()){
      const x=stageX[id],g=group(root,x,.2,-4.7);g.userData.station=id;hitGroups.push(g);
      box(g,['#e5edf0','#e1eaee','#dcebf0','#e5edf0'][i],0,-.006,0,8.3,.045,11.3,true);
      // Low glass dividers keep the cells distinct without blocking transfer routes.
      if(i<3){box(g,'#a8c0cb',4.34,.045,-1.5,.075,.04,7.6);for(const zz of [-5.1,2.2])box(g,'#e0e9ed',4.34,.30,zz,.20,.6,.20,true);}
      box(g,orange,0,.034,-5.5,8.2,.025,.07);
      const station=bench(g,0,0,-3.25,5.7);
      // Replace the kit worktop: both old and new top surfaces were at y=1.065.
      station.remove(station.children[0]);
      surface(station,5.7,.13,1.3,0,1.0,0,steel);
      // Integrated task lighting, storage drawers and service outlets.
      for(const xx of [-2.65,2.65]){rod(station,[xx,0,-.55],[xx,2.35,-.55],.035,'#6c8085');rod(station,[xx,2.35,-.55],[xx,2.35,.45],.035,'#6c8085');}
      box(station,'#61767b',0,2.35,.45,5.4,.065,.18);box(station,'#e9f4e5',0,2.31,.45,5.1,.015,.12,false,true);
      for(const xx of [-2.15,2.15]){box(station,'#a9b7b7',xx,.53,-.06,.8,.85,.7);for(let yy=.25;yy<.9;yy+=.22){box(station,'#e0e5df',xx,yy,.3,.75,.18,.025);box(station,'#556e75',xx,yy+.04,.33,.20,.022,.03);}}
      box(g,'#d9e1dc',-3.2,1.1,-4.8,.55,2.2,.65,true);for(let yy=.5;yy<2;yy+=.35)box(g,'#708a8b',-3.2,yy,-4.46,.38,.03,.03);
      if(id==='receive'){monitor(station,-1.8,1.08,.03);crate(station,1.7,1.1,.05,.9);}
      if(id==='repair'){for(const xx of [-1.5,1.5]){inverter(station,xx,1.08,.08,.95,true);box(station,'#607b81',xx,1.63,-.49,2.3,.97,.06);for(let k=0;k<5;k++)rod(station,[xx-.8+k*.38,1.35,-.44],[xx-.8+k*.38,1.7,-.44],.018,'#d2d8ce');}}
      if(id==='test'){inverter(station,-1.1,1.08,.05,1.05);monitor(station,1.5,1.08,.05);box(g,'#71888c',2.6,1.12,-3.1,1.1,2.2,1);for(let yy=.6;yy<1.9;yy+=.2)box(g,'#b7d3c8',2.6,yy,-2.58,.65,.07,.02);}
      if(id==='handover'){crate(station,-1.1,1.1,.04);monitor(station,1.5,1.08,.04);}
      // Different tools and footprints for each function; keep the front transfer approach clear.
      function supplyRack(rx,rz,packed){
        for(const sx of [-.7,.7])for(const sz of [-.42,.42])rod(g,[rx+sx,0,rz+sz],[rx+sx,2.3,rz+sz],.035,'#637b83');
        for(const height of [.16,.88,1.6]){box(g,'#8fa2a4',rx,height,rz,1.5,.07,.9);for(const sx of [-.38,.38]){if(packed)crate(g,rx+sx,height+.04,rz,.65);else box(g,'#6f9499',rx+sx,height+.19,rz,.6,.3,.65,true);}}
      }
      if(id==='receive'){
        station.scale.x=.68;station.position.x=1.15;
        supplyRack(-2.7,-3.3,true);
        box(g,'#739198',1.15,.08,-1.55,3.6,.09,1.1);
      }
      if(id==='repair'){
        for(const xx of [-1.5,1.5]){box(g,'#3c6a70',xx,.03,-2.45,2.35,.035,1.7);box(station,'#3f7775',xx,1.076,.14,1.9,.012,.83);}
        supplyRack(-3.0,-1.55,false);
      }
      if(id==='test'){
        // Shielded test enclosure, rear access to power racks, operator desk in front.
        for(const xx of [-2.35,.35])for(const zz of [-4.15,-2.45])rod(g,[xx,1.08,zz],[xx,2.48,zz],.028,'#5c7984');
        surface(g,2.7,1.3,.025,-1,1.80,-4.15,glazing);
        for(const xx of [-2.35,.35])surface(g,.025,1.3,1.7,xx,1.80,-3.3,glazing);
        box(g,'#e5aa46',-1,2.49,-2.45,2.7,.045,.05);
        object(g,sphere,'#78bfa3',2.6,2.40,-3.1,.08,.08,.08,false,true);
      }
      if(id==='handover'){
        station.scale.x=.72;station.position.x=-1.0;
        supplyRack(2.75,-3.4,true);
        const roller=group(g,-1,.0,-1.45);
        for(const sx of [-1.75,1.75])box(roller,'#6c858a',sx,.64,0,.08,1.28,.08);
        for(let n=-1.7;n<1.8;n+=.20){const r=object(roller,cylinder,'#a7b4b4',n,1.0,0,.065,1.05,.065);r.rotation.x=Math.PI/2;}
        box(roller,orange,0,.9,.58,3.7,.12,.06);
      }
      for(const [j,xx]of (id==='repair'?[-1.5,1.5]:[id==='receive'?1.15:id==='handover'?-1:1.2]).entries()){const worker=technician(g,xx,id==='handover'?-.55:-2.4,id==='repair'?'repair':id==='receive'?'scan':'work',i+j);crew.push({stage:id,update:worker.update});}
      // Marked WIP parking positions give each device a defined place clear of the operator zone.
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const px=(col-1)*1.75,pz=.1+row*1.65;
        for(const side of [-1,1])box(g,'#b4c8d0',px+side*.69,.038,pz,.025,.012,1.3);
        box(g,'#b4c8d0',px,.038,pz+.65,1.4,.012,.025);
      }
      const ring=group(g,0,.05,0);box(ring,orange,0,0,5.45,8.1,.035,.09,false,true);ring.visible=false;rings.set(id,ring);
      markers.set(id,new T.Vector3(x,3.25,-8.0));
    }
    // Clear linear circulation, separated from work cells and pedestrian apron.
    box(root,'#415b60',0,.23,2.8,36,.04,2.15,true);
    for(const z of [1.67,3.93])box(root,'#e4b06d',0,.26,z,36,.025,.055);
    for(let x=-16;x<17;x+=3){const arrow=new T.Shape();arrow.moveTo(-.4,-.14);arrow.lineTo(.1,-.14);arrow.lineTo(.1,-.35);arrow.lineTo(.55,0);arrow.lineTo(.1,.35);arrow.lineTo(.1,.14);arrow.lineTo(-.4,.14);arrow.closePath();const m=new T.Mesh(new T.ShapeGeometry(arrow),mat('#d3dcd3'));m.rotation.x=-Math.PI/2;m.position.set(x,.265,2.8);root.add(m);}
    board(root,'TRANSFER LANE',0,.28,4.55,3.7,.30,'#667d7d','#dce2df').rotation.x=-Math.PI/2;
    // Dock apron and a separate pedestrian crossing.
    for (const [a,b] of [[-19,-18.25],[-13.75,13.75],[18.25,19]]) {
      box(root,'#b8c6c4',(a+b)/2,.06,7.3,b-a,.20,2.7);
    }
    for(const x of dockX){
      // Recessed loading bays are part of the vehicle carriageway, not the footpath.
      const bayCenter = (dockBayStart + dockRampStart) / 2;
      const bayLength = dockRampStart - dockBayStart;
      box(root,'#53696d',x,dockDeckHeight-.03,bayCenter,dockHalfWidth*2,.06,bayLength).material=roadMaterial;
      addDockRamp(root, x);
      for(const side of [-1,1])box(root,'#e2b46e',x+side*2.05,.223,bayCenter,.065,.006,bayLength-.12);
      box(root,'#e2b46e',x,.235,4.6,4.1,.015,.065);
      // Wheel stop and bay identifier sit inside the bay, clear of the transfer lane.
      box(root,'#394b51',x,.27,4.9,1.5,.18,.18,true);
      board(root,x<0?'01  RECEIVING':'02  DISPATCH',x,.235,5.35,2.65,.30,'#e3d7bd','#53696d').rotation.x=-Math.PI/2;
      for(const side of [-1,1]){box(root,'#485e65',x+side*2.3,.65,4.65,.07,1,.07);board(root,x<0?'IN':'OUT',x+side*2.3,1.16,4.65,.42,.25,'#fff','#c76619');}
    }
    const dockTrucks=[fleetVan(root,-16,.22,6.9,Math.PI,true),fleetVan(root,16,.22,6.9,Math.PI,true)];
    const cargo=[group(root,-17.7,.23,5.6),group(root,14.2,.23,5.6)];
    for(const cart of cargo){box(cart,'#617c83',0,.20,0,.85,.12,.8);crate(cart,0,.27,0,.9);for(const side of [-1,1])rod(cart,[side*.33,.25,-.38],[side*.33,.85,-.38],.022,'#8ca3a6');rod(cart,[-.33,.85,-.38],[.33,.85,-.38],.027,'#8ca3a6');for(const x of [-.34,.34])for(const z of [-.3,.3]){const wheel=object(cart,cylinder,'#334a53',x,.10,z,.10,.07,.10);wheel.rotation.z=Math.PI/2;}}
    const loaders=[technician(root,-17.7,5.1,'push',0),technician(root,14.2,5.1,'push',1)];
    loaders.forEach(loader=>loader.actor.position.y=.23);
    const dockPaths=[
      [[45,10.75],[ -12,10.75],[-15,10.3],[-16,9],[-16,6.9]],
      [[16,6.9],[16,9.6],[17,11.5],[19,13.25],[55,13.25]]
    ];
    function sampleDock(points,progress){
      const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
      let distance=progress*lengths.reduce((a,b)=>a+b,0);
      for(let i=0;i<lengths.length;i++)if(distance<=lengths[i]||i===lengths.length-1){const u=Math.min(1,distance/lengths[i]),a=points[i],b=points[i+1];return {x:a[0]+(b[0]-a[0])*u,z:a[1]+(b[1]-a[1])*u,angle:Math.atan2(b[0]-a[0],b[1]-a[1])};}else distance-=lengths[i];
    }
    function animateDocks(t){
      // Staggered illustrative logistics cycles: both docks are occupied initially.
      for(let i=0;i<2;i++){
        const phase=(t+i*5)%46,truck=dockTrucks[i];
        let route,progress;
        if(phase<14){truck.visible=true;truck.position.set(i?16:-16,.22,6.9);truck.rotation.y=Math.PI;}
        else if(phase<28){route=dockPaths[1].map((p,index)=>[p[0]+(i||index===4?0:-32),p[1]]);progress=(phase-14)/14;}
        else{route=i?[[60,10.75],[20,10.75],[17,10.3],[16,9],[16,6.9]]:dockPaths[0];progress=(phase-28)/18;}
        if(route){const point=sampleDock(route,progress);truck.position.set(point.x,dockHeight(point.z),point.z);truck.rotation.y=phase<28&&point.z<10.5?Math.PI:point.angle;truck.visible=true;}
        truck.userData.logisticsPhase=phase<14?'loading':phase<28?'departing':'arriving';
        const working=phase<14;
        truck.userData.loadingParts.forEach(part=>part.visible=working);truck.userData.tailgate.visible=!working;
        cargo[i].visible=working;loaders[i].actor.visible=working;
        if(working){const step=(Math.sin(t*.75+i)+1)/2,heading=Math.cos(t*.75+i)>=0?1:-1;cargo[i].position.z=4.9+step*(dockRampStart-5.75);cargo[i].rotation.y=heading>0?0:Math.PI;loaders[i].actor.position.z=cargo[i].position.z-heading*.72;loaders[i].actor.rotation.y=cargo[i].rotation.y;loaders[i].update(t);}
      }
    }
    // The front footway continues between both driveway openings.
    for(const x of [-19.5,19.5])for(let z=-12;z<8;z+=3){
      box(root,'#d0dce0',x,.15,z,.85,.35,1.65,true);
      for(let k=0;k<9;k++)object(root,sphere,k%2?'#658b65':'#80a574',x+(k%3-1)*.20,.46+(k%2)*.06,z+(Math.floor(k/3)-1)*.40,.25,.24,.29,true);
    }
    productGallery(root);
    for(const [id,x,z,y]of [['storage',39,3,5.2],['energy',40,-10,3],['fpv',2,31,2]]){const g=group(root,x,0,z);g.userData.station=id;hitGroups.push(g);markers.set(id,new T.Vector3(x,y,z));const ring=group(g);ring.visible=false;rings.set(id,ring);}
    const units=new Map();let simulation=false,simTime=0,simPhase=-1;const demo=createCarrier('DEMO',true);demo.visible=false;
    function createCarrier(id,isDemo=false){const g=group(root);g.userData.caseId=id;g.userData.isDemo=isDemo;box(g,isDemo?orange:'#5f787e',0,.39,0,1.10,.25,1.05,true);for(const x of [-.48,.48])for(const z of [-.35,.35]){const wheel=object(g,cylinder,'#273c41',x,.22,z,.13,.07,.13);wheel.rotation.z=Math.PI/2;}inverter(g,0,.53,0,.72);board(g,id,0,1.34,.25,1.35,.23,'#fff',isDemo?'#b95000':'#304c58');return g;}
    function pathTo(from,to){return [from.clone(),new T.Vector3(from.x,.2,2.8),new T.Vector3(to.x,.2,2.8),to.clone()].filter((p,i,a)=>!i||p.distanceTo(a[i-1])>.001);}
    function assignRoute(item,to){item.route=pathTo(item.mesh.position,to);item.target=to.clone();item.segment=0;item.moving=item.route.length>1;}
    function setCases(rows){
      const seen=new Set(),slots={};
      for(const row of rows){if(!stageIds.includes(row.stage)||row.closed)continue;seen.add(row.id);const n=slots[row.stage]||0;slots[row.stage]=n+1;
        const dest=new T.Vector3(stageX[row.stage]+((n%3)-1)*1.75,.2,-4.6+Math.floor(n/3)*1.65);
        let item=units.get(row.id);
        if(!item){const mesh=createCarrier(row.id);mesh.position.copy(dest);item={mesh,stage:row.stage,route:[],moving:false,target:dest};units.set(row.id,item);}
        else if(item.target.distanceTo(dest)>.01){assignRoute(item,dest);item.stage=row.stage;}
        item.removing=false;item.mesh.userData.stage=row.stage;item.mesh.userData.status=row.status;
      }
      for(const [id,item]of units)if(!seen.has(id)){
        if(rows.some(row=>row.id===id&&row.closed)) {if(!item.removing){assignRoute(item,new T.Vector3(18,.2,5.4));item.removing=true;}}
        else removeUnit(id,item);
      }
    }
    function removeUnit(id,item){root.remove(item.mesh);item.mesh.traverse(o=>{if(o.material?.map){o.material.map.dispose();o.material.dispose();o.geometry?.dispose();}});units.delete(id);}
    function travel(item,delta){if(!item.moving)return;let budget=delta*2.5;while(budget>0&&item.segment<item.route.length-1){const next=item.route[item.segment+1],dir=next.clone().sub(item.mesh.position),distance=dir.length();if(distance<.001){item.segment++;continue;}const step=Math.min(distance,budget);item.mesh.position.addScaledVector(dir.normalize(),step);item.mesh.rotation.y=Math.atan2(dir.x,dir.z);budget-=step;if(step===distance)item.segment++;}if(item.segment>=item.route.length-1){item.moving=false;item.mesh.rotation.y=0;}item.mesh.userData.moving=item.moving;}
    const demoItem={mesh:demo,moving:false,route:[],segment:0};
    animateDocks(0);
    return {hitGroups,markers,rings,
      setCases,
      setSimulation(enabled){simulation=enabled;demo.visible=enabled;simTime=0;simPhase=0;demoItem.moving=false;demo.position.set(stageX.receive,.2,-1.1);},
      getSimulation(){return {enabled:simulation,stage:stageIds[Math.max(0,simPhase)],moving:demoItem.moving};},
      setWorkload(value){workload={...value};},
      inspect(){return [...units.entries()].map(([id,item])=>({id,stage:item.stage,position:item.mesh.position.toArray(),moving:item.moving}));},
      animate(t){const delta=Math.max(0,Math.min(.1,t-previousTime));previousTime=t;animateLandscape(t);animateLake(t);animateDocks(t);
        for(const id of stageIds)clocks[id]=(clocks[id]||0)+(workload[id]>0||simulation?delta:0);
        crew.forEach(({stage,update})=>update(clocks[stage]||0));units.forEach((item,id)=>{travel(item,delta);if(item.removing&&!item.moving)removeUnit(id,item);});
        if(simulation){if(!demoItem.moving){simTime+=delta;if(simTime>4){simTime=0;simPhase=(simPhase+1)%4;assignRoute(demoItem,new T.Vector3(stageX[stageIds[simPhase]],.2,-1.1));}}travel(demoItem,delta);demo.userData.stage=stageIds[simPhase];}
      }
    };
  }
  globalThis.ServiceCampusWorld={buildWorld};
})();
