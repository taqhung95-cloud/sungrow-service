(() => {
  const T = globalThis.THREE;
  if (!T) return;
  const orange = '#ff7900';
  const ink = '#263846';
  const white = '#f1f3f2';
  const steel = '#7e929f';
  const glass = '#5294a5';
  const unit = new T.BoxGeometry();
  const sphere = new T.SphereGeometry(1, 10, 7);
  const cylinder = new T.CylinderGeometry(1, 1, 1, 12);
  const shade = new T.CircleGeometry(1, 16);
  const materials = new Map();
  const roundedGeometry = new Map();

  function softBox(w, h, d) {
    const key = [w,h,d].join(':');
    if (roundedGeometry.has(key)) return roundedGeometry.get(key);
    const radius = Math.min(w,h,d) * .23;
    const r = Math.min(radius,.16);
    const geometry = new T.BoxGeometry(w,h,d,8,8,8);
    const positions = geometry.attributes.position;
    const normal = new T.Vector3();
    const core = new T.Vector3();
    const p = new T.Vector3();
    const steps = [-1,-.866,-.5,0,0,0,.5,.866,1];
    function coordinate(value,size) {
      const index = Math.round((value / size + .5) * 8);
      if (index === 4) return 0;
      return Math.sign(index-4) * (size/2-r) + steps[index]*r;
    }
    for (let i=0;i<positions.count;i++) {
      p.set(coordinate(positions.getX(i),w),coordinate(positions.getY(i),h),coordinate(positions.getZ(i),d));
      core.set(Math.max(-w/2+r,Math.min(w/2-r,p.x)),Math.max(-h/2+r,Math.min(h/2-r,p.y)),Math.max(-d/2+r,Math.min(d/2-r,p.z)));
      normal.copy(p).sub(core).normalize();
      p.copy(core).addScaledVector(normal,r);
      positions.setXYZ(i,p.x,p.y,p.z);
      geometry.attributes.normal.setXYZ(i,normal.x,normal.y,normal.z);
    }
    roundedGeometry.set(key,geometry);
    return geometry;
  }

  function mat(color, glow = false) {
    const key = color + String(glow);
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({
      color, flatShading:false, roughness:.7, emissive:glow ? color : 0, emissiveIntensity:glow ? .48 : 0
    }));
    return materials.get(key);
  }

  function group(parent, x = 0, y = 0, z = 0) {
    const g = new T.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  function object(parent, geometry, color, x, y, z, w, h, d, solid = false, glow = false) {
    const mesh = new T.Mesh(geometry, mat(color, glow));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = solid;
    mesh.receiveShadow = solid;
    parent.add(mesh);
    return mesh;
  }

  function box(parent, color, x, y, z, w, h, d, solid = false, glow = false) {
    if (Math.min(w,h,d) >= .045 && Math.max(w,h,d) < 50)
      return object(parent, softBox(w,h,d), color, x,y,z,1,1,1,solid,glow);
    return object(parent, unit, color, x, y, z, w, h, d, solid, glow);
  }

  function board(parent, text, x, y, z, w, h, color = '#ffffff', bg = '#243949') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.max(32,Math.round(512*h/w));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0,0,512,canvas.height,Math.min(16,canvas.height/4));
    ctx.fill();
    ctx.font = '600 '+ Math.floor(canvas.height*.48) +'px "Sungrow Montserrat", Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 256, canvas.height/2, 460);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const sign = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({map:texture,transparent:true}));
    sign.position.set(x,y,z);
    parent.add(sign);
    return sign;
  }

  function line(parent, a, b, color, width, height = .025) {
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const item = box(parent, color, (a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2, width, height, Math.hypot(dx,dz));
    item.rotation.y = Math.atan2(dx,dz);
    return item;
  }

  function inverter(parent, x, y, z, scale = 1, opened = false) {
    const g = group(parent,x,y,z);
    g.scale.setScalar(scale);
    // Exterior proportions and details follow Sungrow's SG125CX-P2 datasheet.
    box(g, '#616d70',0,.407,0,1.02,.755,.30);
    box(g, opened ? '#364b57' : '#d5d9d9',0,.415,.171,1.00,.755,.055);
    if (!opened) {
      box(g,'#5597c4',0,.577,.202,.033,.041,.008,false,true);
      board(g,'SUNGROW',0,.245,.204,.16,.035,'#707878','#e4e7e6');
      for(const sx of [-.444,0,.444])for(const sy of [.078,.752])
        object(g,cylinder,'#81908f',sx,sy,.205,.012,.009,.012).rotation.x=Math.PI/2;
    }
    for (const side of [-1,1]) {
      box(g,'#a3aeaf',side*.537,.45,0,.034,.48,.055);
      for(let k=0;k<6;k++)box(g,'#404c50',side*.512,.22+k*.075,-.10,.024,.025,.17);
    }
    for (let k = 0; k < 12; k++) box(g, '#283541',-.43+k*.069,.016,.02,.034,.085,.061);
    if (opened) {
      box(g, '#539486',.04,.27,.257,.65,.26,.025);
      for (const cx of [-.19,.07,.27]) box(g, '#8babc1',cx,.28,.282,.12,.11,.043);
    }
    return g;
  }

  function crate(parent, x, y, z, scale = 1) {
    const g = group(parent,x,y,z);
    g.scale.setScalar(scale);
    box(g,'#b98556',0,.26,0,.70,.52,.58);
    box(g,'#d7a879',0,.525,0,.70,.018,.58);
    box(g,'#e3bb8b',0,.267,.296,.11,.50,.018);
    box(g,'#ede5d7',.20,.35,.306,.15,.085,.013);
    return g;
  }

  function shelf(parent,x,y,z) {
    const g = group(parent,x,y,z);
    for (const xSide of [-.95,.95]) {
      for (const zSide of [-.40,.40]) box(g,ink,xSide,1.03,zSide,.07,2.07,.07,true);
    }
    for (const level of [.18,.74,1.31,1.88]) {
      box(g,steel,0,level,0,2,.09,.9);
      box(g,orange,0,level,.47,2,.06,.04);
      for (const offset of [-.59,0,.59]) crate(g,offset,level+.045,0,.68);
    }
  }

  function bench(parent,x,y,z, length = 2.8) {
    const g = group(parent,x,y,z);
    box(g,'#8699a3',0,.99,0,length,.15,.94,true);
    box(g,orange,0,.99,.48,length,.08,.05);
    for (const px of [-length*.42,length*.42]) for (const pz of [-.33,.33]) box(g,ink,px,.47,pz,.09,.94,.09,true);
    return g;
  }

  function monitor(parent,x,y,z) {
    box(parent,ink,x,y+.15,z,.09,.30,.09);
    box(parent,ink,x,y+.42,z,.67,.39,.10);
    box(parent,'#4babc4',x,y+.42,z+.058,.56,.28,.015,false,true);
    box(parent,'#b7e9db',x-.13,y+.45,z+.071,.19,.026,.008,false,true);
  }

  function van(parent,x,y,z, direction, loading) {
    const v = group(parent,x,y,z);
    v.rotation.y = direction;
    box(v, white,0,.88,-.39,1.40,1.30,2.19,true);
    box(v, '#c3d3da',0,.60,1.02,1.38,.76,.89,true);
    box(v, glass,0,1.04,1.21,1.12,.34,.44);
    box(v, orange,0,.50,1.49,1.22,.14,.046);
    for (const side of [-1,1]) {
      box(v,orange,side*.711,.58,-.39,.028,.15,2.13);
      box(v,'#fce3b2',side*.45,.62,1.474,.19,.12,.06,false,true);
      for (const offset of [-.99,.99]) {
        const tire = object(v,cylinder,'#233240',side*.705,.26,offset,.255,.20,.255);
        tire.rotation.z = Math.PI/2;
      }
    }
    if (loading) {
      box(v,ink,0,.85,-1.502,1.19,1.09,.018);
      for (const side of [-1,1]) {
        const door = box(v,white,side*.70,.86,-1.78,.055,1.22,.61);
        door.rotation.y = side * .17;
      }
      const ramp = box(v,steel,0,.15,-1.88,.96,.09,.79);
      ramp.rotation.x = .23;
    }
    return v;
  }

  function person(parent,x,y,z,{shirt = orange, cap = '#f5ac53', face = '#b77652', pose = 'work', phase = 0, angle = 0} = {}) {
    const actor = group(parent,x,y,z);
    actor.rotation.y = angle;
    const shadow = object(actor,shade,'#647681',0,.012,0,.32,.23,1);
    shadow.rotation.x = -Math.PI/2;
    const upper = group(actor,0,.78,0);
    box(upper,shirt,0,.23,0,.43,.49,.27);
    box(upper,'#eceddf',0,.19,.145,.37,.045,.018);
    box(upper,'#f6f2e5',-.13,.36,.144,.095,.064,.018);
    object(upper,sphere,face,0,.65,0,.16,.19,.15);
    object(upper,sphere,cap,0,.76,-.011,.178,.11,.17);
    box(upper,cap,0,.716,.114,.34,.039,.18);
    const limbs = [-1,1].map(side => {
      const arm = group(upper,side*.26,.39,0);
      box(arm,shirt,0,-.14,0,.14,.29,.145);
      const hand = group(arm,0,-.27,0);
      box(hand,face,0,-.10,0,.111,.24,.125);
      const leg = group(actor,side*.105,.80,0);
      box(leg,ink,0,-.345,0,.16,.69,.17);
      box(leg,'#29323c',0,-.74,.045,.17,.12,.25);
      return {arm,hand,leg};
    });
    if (pose === 'repair') box(limbs[1].hand,'#bdc9cd',0,-.23,0,.036,.23,.037);
    if (pose === 'scan') box(limbs[1].hand,'#334d5e',0,-.24,0,.106,.16,.11);
    function update(t) {
      const wave = Math.sin(t * (pose === 'repair' ? 4.6 : 2.2) + phase);
      if (pose === 'walk') {
        const stride = Math.sin(t * 7.1 + phase);
        limbs[0].leg.rotation.x = stride * .47;
        limbs[1].leg.rotation.x = -stride * .47;
        limbs[0].arm.rotation.x = -stride * .37;
        limbs[1].arm.rotation.x = stride * .37;
        upper.position.y = .78 + Math.abs(stride) * .026;
      } else if (pose === 'push') {
        const stride = Math.sin(t * 6.3 + phase);
        limbs[0].leg.rotation.x = stride * .32;
        limbs[1].leg.rotation.x = -stride * .32;
        limbs[0].arm.rotation.x = -1.05;
        limbs[1].arm.rotation.x = -1.05;
        upper.rotation.x = .16;
      } else {
        upper.rotation.x = .07 + wave * .045;
        limbs[0].arm.rotation.x = -.60 + wave * .12;
        limbs[1].arm.rotation.x = -1.07 + wave * .20;
        limbs[1].hand.rotation.x = -.22 + wave * .28;
      }
    }
    update(0);
    return {actor,update};
  }

  function trolley(parent,x,y,z, packed = false) {
    const g = group(parent,x,y,z);
    box(g, '#435966',0,.23,0,.88,.11,1.06);
    box(g, '#e08a46',0,.78,-.49,.80,.055,.06);
    for (const side of [-1,1]) {
      box(g, '#536a77',side*.39,.51,-.49,.045,.55,.045);
      for (const end of [-.41,.41]) {
        const wheel = object(g,cylinder,'#283b48',side*.35,.10,end,.09,.085,.09);
        wheel.rotation.z = Math.PI/2;
      }
    }
    if (packed) crate(g,0,.28,.03,1.02);
    else inverter(g,0,.28,.03,.68);
    return g;
  }

  function district(root) {
    const rotors=[];
    box(root,'#aebcaa',0,-.48,0,220,.50,220,true);
    box(root,'#c8d0cb',0,-.19,0,32,.18,24,true);
    for (const x of [-19,23]) {
      box(root,'#64737b',x,-.19,0,5,.06,160);
      for (let z=-75;z<76;z+=3) box(root,'#e5e6d9',x,-.151,z,.10,.015,1.35);
      for (const side of [-1,1]) box(root,'#dce0d8',x+side*2.7,-.15,0,.7,.12,160);
    }
    for (const z of [-14,14,38,-40]) {
      box(root,'#6c7b82',0,-.19,z,160,.065,4.5);
      for(let x=-75;x<76;x+=3) box(root,'#e5e6d9',x,-.149,z,1.35,.015,.10);
      for(const side of [-1,1]) box(root,'#dce0d8',0,-.15,z+side*2.5,160,.12,.60);
    }
    const foliage = new T.IcosahedronGeometry(1,1);
    const treePositions=[];
    for(let z=-63;z<=63;z+=3.8) {
      for(const x of [-23.2,-15.6,19.4,27.3]) {
        if([-40,-14,14,38].some(road=>Math.abs(road-z)<3.5))continue;
        treePositions.push([x,z]);
      }
    }
    for(let x=-63;x<=63;x+=4.1) {
      if([-19,23].some(road=>Math.abs(road-x)<4))continue;
      for(const z of [-18.1,18.2])treePositions.push([x,z]);
    }
    const crowns=new T.InstancedMesh(foliage,mat('#6c9475'),treePositions.length);
    const trunks=new T.InstancedMesh(cylinder,mat('#867b65'),treePositions.length);
    const transform=new T.Object3D();
    treePositions.forEach(([x,z],i)=>{
      const size=.73+(i%4)*.13;
      transform.position.set(x,1.18,z);transform.scale.set(size,size*1.35,size);
      transform.rotation.set(0,i*.3,.08);transform.updateMatrix();crowns.setMatrixAt(i,transform.matrix);
      transform.position.set(x,.35,z);transform.scale.set(.095,.95,.095);transform.rotation.set(0,0,0);
      transform.updateMatrix();trunks.setMatrixAt(i,transform.matrix);
    });
    root.add(crowns,trunks);
    function pv(x,y,z,w,d) {
      if(y < 1) {
        for(const side of [-1,1]) {
          box(root,'#8a9c9b',x+side*w*.35,.20,z-d*.3,.07,.85,.07);
          box(root,'#8a9c9b',x+side*w*.35,.12,z+d*.3,.07,.65,.07);
        }
      }
      const g=group(root,x,y,z);g.rotation.x=-.16;
      box(g,'#345977',0,0,0,w,.10,d,true);
      for(let n=-w/2+.5;n<w/2;n+=1.05)box(g,'#8ca6b4',n,.059,0,.025,.01,d);
      for(let n=-d/2+.65;n<d/2;n+=1.3)box(g,'#8ca6b4',0,.06,n,w,.01,.024);
    }
    for(const [x,z,w,d,h] of [[-7,-29,16,14,4.5],[10,-29,11,14,3.6],[-34,-6,17,12,4.2],[-34,26,15,12,3.5],[8,29,14,11,3.1]]) {
      box(root,'#e2e6e3',x,h/2-.12,z,w,h,d,true);
      box(root,'#c5d1d3',x,h,z,w+.3,.17,d+.3,true);
      box(root,orange,x,h-.29,z+d/2+.035,w,.12,.06);
      for(let n=-w/2+1;n<w/2;n+=1.6)box(root,glass,x+n,h*.6,z+d/2+.04,.9,1.3,.045);
      pv(x,h+.24,z,w-2,d-2);
    }
    for(let row=0;row<3;row++)for(let col=0;col<4;col++)pv(33+col*4.4,.65,-31+row*5.1,3.7,3.5);
    for(let i=0;i<7;i++){
      const x=30+i*2.0,z=2.0;
      // PowerStack ST225: 1.15 m wide, 2.45 m high, 1.61 m deep.
      box(root,'#34434a',x,.02,z,1.25,.20,1.70,true);
      box(root,'#e7ebe7',x,1.29,z,1.15,2.45,1.61,true);
      box(root,'#f2f3ef',x,1.29,z+.815,1.07,2.26,.025);
      box(root,orange,x,2.48,z+.84,.68,.052,.020);
      box(root,'#46545a',x,1.98,z+.838,.79,.50,.018);
      for(let vent=0;vent<8;vent++)box(root,'#b1bbba',x,1.76+vent*.062,z+.85,.77,.013,.013);
      for(let vent=0;vent<12;vent++)box(root,'#b1bbba',x-.36+vent*.065,1.98,z+.85,.012,.49,.013);
      box(root,'#7e8c90',x-.41,.94,z+.85,.028,.25,.023);
      object(root,sphere,'#f2b323',x,1.34,z+.85,.047,.047,.016);
      object(root,sphere,'#d74832',x,1.34,z+.87,.023,.023,.012);
      board(root,'SUNGROW',x,2.32,z+.85,.53,.09,'#6d7775','#f2f3ef');
    }
    board(root,'PowerStack · C&I ESS',36,3.35,3.7,6,.5,'#273e48','#edf1ed');
    for(const [x,z]of [[-30,-23],[-7,-48],[30,-24],[39,25],[-37,24]]){
      const tower=group(root,x,-.15,z);
      object(tower,new T.CylinderGeometry(.13,.37,9,10),'#e1e6e5',0,4.5,0,1,1,1,true);
      object(tower,sphere,'#dbe3e3',0,9,.20,.42,.39,.70);
      const rotor=group(tower,0,9,.83);rotors.push(rotor);
      for(let k=0;k<3;k++){
        const blade=group(rotor);blade.rotation.z=k*Math.PI*2/3;
        const wing=box(blade,'#eaf0ed',.18,1.75,0,.27,3.6,.075);wing.rotation.z=-.08;
      }
    }
    // Residential edge and rooftop PV: a continuous energy district.
    for(let i=0;i<8;i++) {
      const x=-34+(i%4)*5.3,z=24+Math.floor(i/4)*7;
      box(root,i%2?'#ede6d9':'#dde5e1',x,1.1,z,3.5,2.4,4.1,true);
      const roof=object(root,new T.CylinderGeometry(2.9,2.9,4.5,3),'#73848a',x,2.8,z,1,1,1,true);
      roof.rotation.x=Math.PI/2;
      box(root,glass,x,1.3,z+2.07,1.5,.85,.06);
      pv(x,3.2,z,2.7,2.8);
    }
    const vehicles=[van(root,-20.1,0,0,0,false),van(root,24.1,0,0,Math.PI,false),van(root,0,0,15.1,Math.PI/2,false),van(root,0,0,-15.1,-Math.PI/2,false)];
    const energyPath=[new T.Vector3(46,.04,-17),new T.Vector3(29,.04,-17),new T.Vector3(29,.04,2),new T.Vector3(30,.04,2)];
    for(let i=1;i<energyPath.length;i++)line(root,energyPath[i-1].toArray(),energyPath[i].toArray(),'#bb936a',.055);
    const energyDots=Array.from({length:5},()=>object(root,sphere,'#ffb43b',0,.12,0,.13,.13,.13,false,true));
    return t=>{
      rotors.forEach((rotor,i)=>rotor.rotation.z=t*(.36+i*.025));
      vehicles[0].position.z=((t*1.9+22)%130)-65;
      vehicles[1].position.z=65-((t*1.6+47)%130);
      vehicles[2].position.x=((t*1.7+70)%140)-70;
      vehicles[3].position.x=70-((t*1.5+100)%140);
      energyDots.forEach((dot,i)=>{
        const distance=(t*1.2+i*7.4)%37;
        const segment=distance<17?0:distance<36?1:2;
        const offset=segment===0?distance/17:segment===1?(distance-17)/19:distance-36;
        dot.position.lerpVectors(energyPath[segment],energyPath[segment+1],offset);dot.position.y=.13;
      });
      treePositions.forEach(([x,z],i)=>{
        const size=.73+(i%4)*.13;
        transform.position.set(x,1.18,z);transform.scale.set(size,size*1.35,size);
        transform.rotation.set(.025*Math.sin(t*.8+i),i*.3,.04*Math.sin(t*.65+i));
        transform.updateMatrix();crowns.setMatrixAt(i,transform.matrix);
      });
      crowns.instanceMatrix.needsUpdate=true;
    };
  }

  function buildWorld(scene) {
    const root = group(scene);
    const floorY = .14;
    const crew = [];
    let workload = {};
    const clocks = {};
    let previousTime = 0;
    const addCrew = (stage,update) => crew.push({stage,update});
    const hitGroups = [];
    const markers = new Map();
    const rings = new Map();

    const animateDistrict=district(root);
    box(root,'#7b8a94',0,-.08,0,29.3,.12,20.5,true);
    box(root,'#d27439',0,-.20,10.38,28.9,.11,.10);
    box(root,'#4c606e',0,-.009,7.15,28.9,.035,5.15);
    for (let x=-13; x<=13; x+=2) box(root,'#b0bdc4',x,.016,8.62,.99,.012,.047);
    for (const z of [-9.6,9.85]) box(root,'#bac4c7',0,.005,z,28.3,.025,.046);
    for (const x of [-14.25,14.25]) box(root,'#bac4c7',x,.007,0,.047,.025,19.6);
    for (const x of [-12.1,11.75]) {
      for (let i=0;i<5;i++) box(root,'#c7c8bc',x+i*.28,.025,5.10,.14,.018,.82);
    }

    const factory = group(root,0,floorY,-3.75);
    box(factory,'#bac6cc',0,-.085,0,27.4,.15,11.8,true);
    box(factory,white,0,1.62,-5.52,27.5,3.29,.25,true);
    box(factory,'#bacbd2',0,1.74,-5.376,26.7,.65,.045);
    box(factory,orange,0,3.36,-5.37,27.5,.37,.35,true);
    box(factory,ink,0,3.60,-5.54,27.65,.13,.32);
    box(factory,white,-13.55,1.62,-2.3,.25,3.29,6.7,true);
    box(factory,white,13.55,1.62,-2.3,.25,3.29,6.7,true);
    const awning = box(factory,'#d5dfe1',0,3.18,-4.24,27.25,.19,2.80,true);
    awning.rotation.x = -.052;
    box(factory,orange,0,3.11,-2.84,27.32,.22,.20);
    board(factory,'SUNGROW SERVICE',0,3.10,-2.72,5.6,.77,'#ff8737','#243847');
    for (const x of [-13.4,-6.35,4.35,13.4]) {
      box(factory,steel,x,1.52,-2.78,.18,3.15,.18,true);
      box(factory,'#374b59',x,.20,-2.78,.28,.44,.27);
    }
    for (let x=-12.3;x<13;x+=2.05) {
      box(factory,'#698a9b',x,2.34,-5.348,1.51,.58,.063);
      box(factory,'#a7bcc5',x,2.34,-5.31,.035,.59,.02);
    }

    function zone(id,x,z,w,d,color,caption) {
      const station = group(root,x,floorY,z);
      station.userData.station = id;
      hitGroups.push(station);
      box(station,color,0,-.014,0,w,.046,d).receiveShadow = true;
      box(station,'#bbc6c9',0,.014,d/2-.09,w,.026,.14);
      box(station,orange,-w/2+.07,.015,0,.13,.027,d);
      // Screen-space labels carry the station names without duplicate floor text.
      const border = group(station,0,.057,0);
      for (const side of [-1,1]) {
        box(border,'#ff9f56',side*w/2,0,0,.08,.028,d,false,true);
        box(border,'#ff9f56',0,0,side*d/2,w,.028,.08,false,true);
      }
      border.visible = false;
      rings.set(id,border);
      markers.set(id,new T.Vector3(x,floorY+2.85,z+.25));
      return station;
    }

    const receive = zone('receive',-10,-2.45,6.3,6.7,'#c6cacc','01  TIẾP NHẬN');
    const frontDesk = bench(receive,-.77,0,-1.55,2.8);
    monitor(frontDesk,-.62,1.04,0);
    crate(frontDesk,.55,1.07,.09,.80);
    shelf(receive,1.9,0,-2.26);
    crate(receive,-2.26,.01,.24,1.22);
    crate(receive,-1.35,.01,.24,1.10);
    const inbound = person(receive,-.76,0,-.49,{pose:'scan',angle:Math.PI,phase:.7});
    addCrew('receive',inbound.update);
    const checkIn = person(receive,.86,0,.19,{pose:'work',angle:-1.42,shirt:'#526f87',cap:'#edede1',phase:1.7});
    addCrew('receive',checkIn.update);
    van(root,-11.0,0,5.76,.32,true);
    for (let i=0;i<3;i++) crate(root,-9.95 + .64*i,.02,3.59,.9);

    const repair = zone('repair',-.95,-2.30,10.1,7.15,'#cdd1d1','02  SỬA CHỮA');
    for (const [i,x] of [-3.25,0,3.23].entries()) {
      const workstation = bench(repair,x,0,-1.33,2.73);
      box(workstation,'#536c79',0,1.56,-.40,2.62,.96,.077,true);
      for (let col=0;col<7;col++) {
        box(workstation,col % 2 ? '#b7c8cf' : '#d19762',-.98+col*.31,1.68,-.346,.075,.29,.026);
      }
      inverter(workstation,.22,1.067,.12,1.12,true);
      box(workstation,'#bbc4bc',-.83,1.09,.18,.43,.041,.32);
      const engineer = person(repair,x+.16,0,-.27,{pose:'repair',angle:Math.PI,phase:i*2.02,shirt:i===1?'#537387':orange,cap:i===1?'#e2e7e3':'#efb35b'});
      addCrew('repair',engineer.update);
    }
    shelf(repair,-3.48,0,1.78);
    shelf(repair,-1.40,0,1.78);
    inverter(repair,2.51,.02,1.65,1.08);
    inverter(repair,3.62,.02,1.65,1.08);

    const test = zone('test',8.66,-2.48,7.75,6.78,'#b9c9cd','03  KIỂM THỬ');
    const rig = bench(test,-.66,0,-1.52,3.82);
    inverter(rig,-.68,1.067,.14,1.12);
    monitor(rig,.68,1.06,.13);
    line(rig,[-.65,1.14,.43],[.63,1.14,.43],'#e1a953',.040);
    box(test,'#557782',2.66,1.10,-1.51,1.05,2.2,.89,true);
    box(test,'#9ee1cc',2.66,1.70,-1.041,.65,.18,.042,false,true);
    box(test,'#38515d',2.66,.90,-1.034,.76,.72,.04);
    const tester = person(test,.53,0,-.46,{pose:'work',angle:Math.PI,shirt:'#547588',cap:'#f0eee6',phase:.4});
    addCrew('test',tester.update);

    const handover = zone('handover',7.35,4.85,9.9,4.6,'#c3c8ca','04  BÀN GIAO');
    const pack = bench(handover,-1.10,0,-1.12,2.9);
    crate(pack,-.68,1.065,.04,1.05);
    box(pack,'#d5e0e1',.45,1.085,.12,.49,.045,.32);
    monitor(pack,.91,1.07,-.20);
    van(handover,3.32,0,.45,Math.PI/2,true);
    for (let i=0;i<3;i++) crate(handover,-.31+i*.79,.01,1.63,.95);
    const dispatcher = person(handover,-1.20,0,-.06,{pose:'scan',angle:Math.PI,phase:2.4});
    addCrew('handover',dispatcher.update);
    const deliveryCart = trolley(handover,.6,.025,.42,true);
    const loader = person(handover,-.2,.025,.42,{pose:'push',angle:Math.PI/2,phase:1.3});
    addCrew('handover',t => {
      const phase = t * .52 + .3;
      const heading = Math.cos(phase) < 0 ? -1 : 1;
      const x = .16 + Math.sin(phase) * .81;
      deliveryCart.position.x = x;
      deliveryCart.rotation.y = heading * Math.PI / 2;
      loader.actor.position.x = x - heading * .86;
      loader.actor.rotation.y = deliveryCart.rotation.y;
      loader.update(t);
    });

    const cart = trolley(root,-8,.033,2.33);
    const mover = person(root,-8,.033,2.94,{pose:'push',angle:Math.PI/2,shirt:'#527387',cap:'#ffbe63'});
    const walking = person(root,6,.025,8.01,{pose:'walk',angle:-Math.PI/2,shirt:'#c6733c',cap:'#f0e1b5',phase:.7});
    addCrew('transport',t => {
      const position = Math.sin(t*.35);
      const heading = Math.cos(t*.35) < 0 ? -1 : 1;
      const x = -4.7 + position*3.55;
      cart.position.x = x;
      cart.rotation.y = heading*Math.PI/2;
      mover.actor.position.set(x-heading*.86,.024,2.33);
      mover.actor.rotation.y = heading*Math.PI/2;
      mover.update(t);
      walking.actor.position.x = 1.45 + Math.sin(t*.29+1.2)*3.00;
      walking.actor.rotation.y = Math.cos(t*.29+1.2) < 0 ? -Math.PI/2 : Math.PI/2;
      walking.update(t);
    });

    for (let i=0;i<14;i++) {
      const x = -11.6 + i*1.68;
      box(root,i % 2 ? '#c8a87d' : '#d98c4b',x,.024,1.62,.76,.020,.067);
      for (const z of [-8.7,9.45]) {
        if (i % 2) continue;
        box(root,ink,x,.71,z,.065,1.46,.065,true);
        box(root,'#f4c794',x,1.46,z,.22,.14,.18,false,true);
      }
    }
    for (const x of [-13.7,13.7]) {
      for (const z of [-7.4,-4.7,2.55,4.2]) {
        box(root,orange,x,.25,z,.13,.51,.13);
        box(root,'#eac5a1',x,.40,z,.142,.070,.142);
      }
    }
    for (const x of [-10.7,-7.8,-4.9]) {
      const panel = group(root,x,3.50,-7.78);
      panel.rotation.x = -.13;
      box(panel,'#304d68',0,0,0,2.50,.10,1.54,true);
      for (let i=0;i<5;i++) box(panel,'#6386a1',-.96+i*.48,.062,0,.021,.009,1.44);
      box(panel,'#6386a1',0,.062,0,2.45,.009,.022);
    }
    const storageView=group(root,36,0,2);
    storageView.userData.station='storage';
    hitGroups.push(storageView);
    markers.set('storage',new T.Vector3(36,3.9,2));
    const storageRing=group(storageView,0,.04,0);
    for(const z of [-1.2,1.2])box(storageRing,orange,0,0,z,15,.025,.07,false,true);
    storageRing.visible=false;
    rings.set('storage',storageRing);
    const energyView=group(root,29,0,-28);
    energyView.userData.station='energy';hitGroups.push(energyView);
    markers.set('energy',new T.Vector3(33,2,-24));
    const energyRing=group(energyView);energyRing.visible=false;rings.set('energy',energyRing);
    crew.forEach(({update}) => update(0));
    return {hitGroups,markers,rings,
      setWorkload(value) { workload = {...value}; workload.transport = (value.receive || 0) + (value.handover || 0); },
      animate(t) {
        animateDistrict(t);
        const delta = Math.max(0,Math.min(.1,t-previousTime)); previousTime=t;
        for (const stage of ['receive','repair','test','handover','transport'])
          clocks[stage] = (clocks[stage] || 0) + (workload[stage] > 0 ? delta : 0);
        crew.forEach(({stage,update}) => update(clocks[stage] || 0));
      }
    };
  }

  globalThis.ServiceCampusWorld = {buildWorld};
  globalThis.ServiceCampusKit = {T,group,box,object,mat,board,line,inverter,crate,bench,monitor,person,van,sphere,cylinder};
})();
