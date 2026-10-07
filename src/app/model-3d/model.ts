import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Architectural proportions are estimated, not surveyed. Front faces +Z.
const WIDTH = 112;
const DEPTH = 26;
const HEIGHT = 24;

function texture(draw: (ctx: CanvasRenderingContext2D) => void, width = 512, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không khởi tạo được chất liệu canvas.");
  draw(ctx);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function material(name: string, color: string, roughness = .8, metalness = 0) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  mat.name = name;
  return mat;
}

// Independent, tileable height and roughness data; dimensions stay in model units.
function mineralTextures() {
  const height = texture(ctx => {
    const pixels = ctx.createImageData(512, 512);
    let seed = 73;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed >>> 8) / 16777216;
    };
    const coarse = Array.from({ length: 32 * 32 }, random);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const gx = x / 16, gy = y / 16;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      const u = gx - ix, v = gy - iy;
      const sample = (dx: number, dy: number) => coarse[((iy + dy) % 32) * 32 + (ix + dx) % 32];
      const low = THREE.MathUtils.lerp(THREE.MathUtils.lerp(sample(0, 0), sample(1, 0), u), THREE.MathUtils.lerp(sample(0, 1), sample(1, 1), u), v);
      const value = Math.round(104 + low * 38 + random() * 16);
      const offset = (y * 512 + x) * 4;
      pixels.data[offset] = value; pixels.data[offset + 1] = value; pixels.data[offset + 2] = value; pixels.data[offset + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  });
  const roughness = texture(ctx => {
    const pixels = ctx.createImageData(256, 256);
    let seed = 271;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const value = 229 + (seed >>> 28);
      pixels.data[i] = value; pixels.data[i + 1] = value; pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }, 256, 256);
  for (const map of [height, roughness]) {
    map.colorSpace = THREE.NoColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
  }
  const image = height.image.getContext("2d")!.getImageData(0, 0, 512, 512);
  const normal = texture(ctx => {
    const pixels = ctx.createImageData(512, 512);
    const sample = (x: number, y: number) => image.data[((y + 512) % 512 * 512 + (x + 512) % 512) * 4] / 255;
    const n = new THREE.Vector3();
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const offset = (y * 512 + x) * 4;
      n.set(sample(x - 1, y) - sample(x + 1, y), sample(x, y - 1) - sample(x, y + 1), 1).normalize();
      pixels.data[offset] = (n.x * .5 + .5) * 255; pixels.data[offset + 1] = (n.y * .5 + .5) * 255;
      pixels.data[offset + 2] = n.z * 255; pixels.data[offset + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  });
  normal.colorSpace = THREE.NoColorSpace; normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  height.dispose();
  return { normal, roughness };
}

function glazingNormals() {
  const map = texture(ctx => {
    const pixels = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const u = x / 256 * Math.PI * 2, v = y / 256 * Math.PI * 2;
      const offset = (y * 256 + x) * 4;
      pixels.data[offset] = 128 + 3 * Math.sin(u + Math.sin(v) * .4);
      pixels.data[offset + 1] = 128 + 2 * Math.sin(v * 2 + Math.cos(u));
      pixels.data[offset + 2] = 255; pixels.data[offset + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }, 256, 256);
  map.colorSpace = THREE.NoColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

// Bake static geometry by material: detailed railings and mullions cost one draw per material.
function batch(group: THREE.Group) {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.updateMatrixWorld(true);
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    const geometry = (child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()).applyMatrix4(child.matrix);
    const list = buckets.get(child.material) ?? [];
    list.push(geometry);
    buckets.set(child.material, list);
    child.geometry.dispose();
    group.remove(child);
  }
  for (const [mat, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) throw new Error(`Không ghép được hình học: ${mat.name}`);
    const indexed = mergeVertices(merged);
    merged.dispose();
    const mesh = new THREE.Mesh(indexed, mat);
    mesh.name = mat.name;
    mesh.userData.renderRole = mat.userData.renderRole ?? "structure";
    mesh.castShadow = !["glazing", "water", "decal"].includes(mesh.userData.renderRole) && mat.userData.castShadow !== false;
    mesh.receiveShadow = true;
    indexed.computeBoundingBox();
    indexed.computeBoundingSphere();
    group.add(mesh);
  }
}

/** Authoring source only; the viewer loads the versioned GLB derivative. */
export function createBuilding() {
  const building = new THREE.Group();
  building.name = "Building";
  building.userData = { dimensions: "Estimated, not surveyed", units: "estimated-model-units", up: "Y", front: "+Z" };

  const { normal: grain, roughness } = mineralTextures();
  const white = material("Cool-white mineral facade cladding", "#e0e4e0", .56);
  white.normalMap = grain; white.roughnessMap = roughness;
  white.normalScale.set(.12, .12);
  white.userData.textureScale = 3;
  const concrete = material("Rear pale grey concrete", "#bcc0bb", .92);
  concrete.normalMap = grain; concrete.roughnessMap = roughness;
  concrete.normalScale.set(.25, .25);
  const interior = material("Recessed neutral structural surfaces — illustrative", "#b7b9af", .87);
  interior.normalMap = grain; interior.roughnessMap = roughness;
  interior.normalScale.set(.18, .18);
  // Dielectric Fresnel keeps the glass reflective at grazing angles, not black metal.
  const dark = new THREE.MeshPhysicalMaterial({
    color: "#45586a", roughness: .065, metalness: 0, ior: 1.52,
    transmission: .36, thickness: .025, attenuationColor: "#5b6d80", attenuationDistance: 1.2,
  });
  dark.name = "Charcoal navy violet reflective glazing";
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#cad9d9", roughness: .08, metalness: 0, ior: 1.52,
    transmission: .76, thickness: .018, attenuationColor: "#b6cac5", attenuationDistance: 4,
  });
  glass.name = "Cool grey reflective storefront glass";
  const glassNormal = glazingNormals();
  for (const glazing of [dark, glass]) {
    glazing.normalMap = glassNormal;
    glazing.normalScale.set(.35, .35);
    glazing.userData.renderRole = "glazing";
    glazing.userData.textureScale = .35;
  }
  const steel = material("Graphite aluminium mullions and railings", "#40494d", .3, .78);
  const silver = material("Brushed silver horizontal roof tanks", "#c7cdd4", .3, .88);
  const trim = material("Grey violet fascia and billboard frame", "#656779", .6, .2);
  const board = material("Blank off-white central billboard", "#dddcd4", .82);
  const red = material("Red rear fire cabinets", "#a72b3a");
  const solar = material("Deep blue photovoltaic cells", "#ffffff", .34, .35);
  solar.map = texture(ctx => {
    ctx.fillStyle = "#1d233a"; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "#626c80"; ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(i * 512 / 12, 0); ctx.lineTo(i * 512 / 12, 512); ctx.stroke(); }
    for (let i = 0; i <= 24; i++) { ctx.beginPath(); ctx.moveTo(0, i * 512 / 24); ctx.lineTo(512, i * 512 / 24); ctx.stroke(); }
    ctx.strokeStyle = "#c0c5cc"; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 506, 506);
  });

  function box(group: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, rx = 0, ry = 0, rz = 0) {
    const bevel = mat === white ? Math.min(.035, w * .12, h * .12, d * .12) : 0;
    const geometry = bevel > 0 ? new RoundedBoxGeometry(w, h, d, 1, bevel) : new THREE.BoxGeometry(w, h, d);
    if (mat instanceof THREE.MeshStandardMaterial && (mat.bumpMap || mat.normalMap)) {
      // Metre-scaled UVs keep grain fine on long slabs and narrow reveals alike.
      const position = geometry.getAttribute("position");
      const normal = geometry.getAttribute("normal");
      const uv = geometry.getAttribute("uv");
      for (let i = 0; i < position.count; i++) {
        const u = Math.abs(normal.getX(i)) > .5 ? position.getZ(i) + z : position.getX(i) + x;
        const v = Math.abs(normal.getY(i)) > .5 ? position.getZ(i) + z : position.getY(i) + y;
        const scale = typeof mat.userData.textureScale === "number" ? mat.userData.textureScale : .8;
        uv.setXY(i, u * scale, v * scale);
      }
    }
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); group.add(mesh);
    return mesh;
  }
  function cylinder(group: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, top: number, bottom: number, h: number, segments = 40) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, h, segments), mat);
    mesh.position.set(x, y, z); group.add(mesh); return mesh;
  }
  function bar(group: THREE.Group, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, width: number) {
    const middle = a.clone().add(b).multiplyScalar(.5);
    const mesh = box(group, mat, middle.x, middle.y, middle.z, width, a.distanceTo(b), width);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }

  // A shell and recessed structure leave an actual cavity behind glazing. These are
  // render proxies at the existing estimated storey heights, not leased-space plans.
  box(building, concrete, 0, HEIGHT / 2, -12.15, WIDTH - 1.2, HEIGHT, .5);
  for (const side of [-1, 1]) box(building, interior, side * 50, HEIGHT / 2, -1, .35, HEIGHT, 22);
  for (let floor = 0; floor <= 6; floor++) box(building, interior, 0, floor * 4, -.1, WIDTH - 1, .2, DEPTH - 1);
  for (const x of [-46, -23, 0, 23, 46]) for (const z of [-5, 4]) box(building, interior, x, HEIGHT / 2, z, .45, HEIGHT, .45);
  // A recessed, continuous curtain wall behind the white cut-out screens.
  box(building, dark, 0, 14, 12.1, WIDTH, 20, .035);
  box(building, glass, 0, 2.2, 12.1, WIDTH, 4.4, .035);
  for (let x = -55; x <= 55; x += 2.25) box(building, steel, x, 14, 12.2, .065, 20, .18);
  for (let y = 4.4; y < 24; y += 4) box(building, steel, 0, y, 12.2, WIDTH, .09, .18);
  for (let x = -54; x < 56; x += 2.25) box(building, steel, x, 2.2, 12.2, .05, 4.4, .18);
  for (let x = -54; x < 56; x += 7.5) {
    box(building, white, x, 2.2, 13, .52, 4.4, .6);
    box(building, steel, x + 2.8, 1.35, 12.3, 1.65, .08, .08);
    box(building, steel, x + 2, 1.3, 12.3, .07, 2.6, .08);
    box(building, steel, x + 3.6, 1.3, 12.3, .07, 2.6, .08);
  }
  box(building, trim, 0, 4.6, 13.1, WIDTH + .3, .38, .85);

  // Slots follow the irregular facade rhythm visible in frame 35 (not a regular window grid).
  const upperSlots: [number, number][] = [[-53,1.1],[-50.5,1.3],[-48,1.6],[-45.4,.85],[-30,.7],[-27,1.4],[-24.8,.8],[-23,1.2],[-21.3,.65],[-18.4,1],[-15,1.25],[-12.9,.8],[-10.3,1.4],[-7.8,.85],[-5.3,.85],[-3.7,.55],[-1.8,1.4],[1.7,.7],[3.2,.5],[4.5,.55],[5.8,.7],[7.5,1.5],[10.3,1.1],[13.7,.85],[15.4,1.1],[29.2,.9],[31.4,.6],[33.2,.85],[35.1,1.25],[37,.9],[39.8,.8],[43,.7],[44.5,.6],[46.1,1.2],[49,.7],[50.5,.55],[52,.7],[54,.7]];
  const lowerSlots: [number, number][] = [[-44.5,1.2],[-41.6,.85],[-40.2,.5],[-38.8,.65],[-37.5,.6],[-35.5,.85],[-31.9,1.5],[-29.5,.7],[-27.8,.55],[-24.2,1.2],[-20.9,1.4],[-17.7,1.3],[-15.5,.75],[-13.8,.65],[9.4,.6],[11,.6],[12.6,.6],[14.2,1.15],[17.1,1.2],[20.4,1.25],[23.5,.7],[25,.5],[26.5,.65],[28,.55],[31.4,1.2],[33.4,.7],[35,.6],[50.2,.9]];
  function screen(y: number, h: number, slots: [number, number][], exclusions: [number, number][]) {
    const holes = [...slots.map(([x, w]): [number, number] => [x - w / 2, x + w / 2]), ...exclusions].sort((a,b) => a[0] - b[0]);
    box(building, white, 0, y + h / 2 - .45, 12.745, WIDTH, .9, 1.05);
    box(building, white, 0, y - h / 2 + .25, 12.745, WIDTH, .5, 1.05);
    let edge = -56;
    for (const [start, end] of holes) {
      if (start > edge) box(building, white, (edge + start) / 2, y, 12.745, start - edge, h - 1.4, 1.05);
      edge = Math.max(edge, end);
    }
    if (edge < 56) box(building, white, (edge + 56) / 2, y, 12.745, 56 - edge, h - 1.4, 1.05);
    for (const [x, w] of slots) box(building, steel, x, y - h / 2 + .53, 12.77, w, .055, .94);
  }
  screen(21, 6, upperSlots, [[-42,-31.5],[18,27]]);
  screen(11, 5, lowerSlots, [[-56,-48],[-12,8.7],[38,47.5],[52,56]]);
  // Three large recessed glazing bays, with proud white perimeter frames.
  for (const [x,w,y,h] of [[-36.75,10.5,18.2,10.8],[22.5,9,18.2,10.8],[42.75,9.5,13.25,8.5]]) {
    box(building, white, x - w / 2, y, 13.3, .4, h, .75);
    box(building, white, x + w / 2, y, 13.3, .4, h, .75);
    box(building, white, x, y + h / 2, 13.3, w + .4, .4, .75);
    box(building, white, x, y - h / 2, 13.3, w + .4, .4, .75);
    box(building, steel, x, y - h / 2 + .23, 12.8, w - .4, .06, .95);
  }
  box(building, trim, -2, 13.1, 13.7, 21.7, 8.5, .65);
  box(building, board, -2, 13.1, 14.05, 20.7, 7.5, .1);
  box(building, steel, -2, 4.05, 16.2, 15, .28, 6.4);
  box(building, solar, -2, 4.24, 16.2, 14.6, .1, 6.1);
  for (const x of [-8.7,4.7]) box(building, steel, x, 1.95, 18.9, .16, 3.9, .16);
  const lettering = material("Entrance Le Grande Centre lettering", "#ffffff");
  lettering.map = texture(ctx => { ctx.clearRect(0,0,1024,128); ctx.fillStyle = "#ededeb"; ctx.textAlign = "center"; ctx.font = "600 65px Arial"; ctx.fillText("LE GRANDE CENTRE",512,87); },1024,128);
  lettering.transparent = true;
  lettering.userData.renderRole = "decal";
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12,1.5),lettering);
  sign.position.set(-2,4.15,19.46);building.add(sign);

  // Both end elevations have their own slits and staggered horizontal glazing bays.
  for (const side of [-1,1]) {
    box(building, white, side * 56.15, 4.675, 0, .45, .55, 26);
    let bottom = 8.25;
    for (const [row,y] of [11,16,21].entries()) {
      const lo = y - 1.7;
      box(building, white, side * 56.15, (bottom + lo) / 2, 0, .45, lo - bottom, 26);
      let edge = -13;
      for (let z = -10.5; z <= 11; z += 2) {
        const wide = (row === 1 && z > 2) || (row === 2 && z < -4);
        const w = wide ? 1.9 : .7;
        const h = wide ? 3.4 : 3.05;
        const start = z - w / 2;
        box(building, white, side * 56.15, y, (edge + start) / 2, .45, 3.4, start - edge);
        if (h < 3.4) for (const direction of [-1,1]) {
          box(building, white, side * 56.15, y + direction * (h + 3.4) / 4, z, .45, (3.4 - h) / 2, w);
        }
        box(building, dark, side * 55.85, y, z, .08, h, w);
        box(building, steel, side * 56.1, y - h / 2 + .03, z, .46, .06, w);
        edge = z + w / 2;
      }
      box(building, white, side * 56.15, y, (edge + 13) / 2, .45, 3.4, 13 - edge);
      bottom = y + 1.7;
      box(building, white, side * 56.5, y - 2.4, 0, .15, .24, 26);
    }
    box(building, white, side * 56.15, (bottom + 24) / 2, 0, .45, 24 - bottom, 26);
    box(building, dark, side * 55.85, 6.6, 0, .09, 3.3, 25.6);
    box(building, glass, side * 55.85, 2.2, 0, .08, 4.3, 25.7);
    for (let z = -12; z < 13; z += 2.25) box(building, steel, side * 55.92, 2.2, z, .055, 4.3, .05);
  }
  // Six-storey rear service balconies with slender graphite handrails.
  for (let floor = 1; floor <= 6; floor++) {
    const y = floor * 4;
    box(building, concrete, 0, y, -13.8, WIDTH, .28, 3.6);
    box(building, steel, 0, y + 1.1, -15.5, WIDTH, .075, .075);
    box(building, steel, 0, y + .15, -15.5, WIDTH, .055, .055);
    for (let x = -55.7; x < 56; x += .55) box(building, steel, x, y + .6, -15.5, .035, 1, .035);
    for (const x of [-55,-30,-4,22,55]) {
      box(building, white, x, y - 1.95, -13.1, .4, 3.65, .65);
      box(building, red, x + .5, y - 2.2, -12.94, .65, 1.25, .15);
    }
    for (const x of [-45,-19,5,32]) box(building, dark, x, y - 1.8, -12.99, 1.05, 2.3, .12);
    if (floor < 6) {
      const left = floor % 2 === 0 ? 41 : 52;
      const right = floor % 2 === 0 ? 52 : 41;
      bar(building, steel, new THREE.Vector3(left,y,-16.4),new THREE.Vector3(right,y+4,-16.4),.22);
      bar(building, steel, new THREE.Vector3(left,y+1,-17.25),new THREE.Vector3(right,y+5,-17.25),.08);
      for(let step=0;step<18;step++) box(building, steel, left+(right-left)*step/18,y+4*step/18,-16.4,.65,.11,1.8);
    }
  }
  box(building, white, 0, 24.1, 0, WIDTH, .28, DEPTH);
  // Solar fields are elevated tilted geometry, with a central white roof plant room.
  for (const [lo,hi] of [[-55,-8],[9,55]]) {
    for (let x = lo + 2.05; x < hi; x += 4.15) {
      for (const direction of [-1,1]) {
        box(building, solar, x, 25.8, direction*6.1, 4, .09, 12.1, direction * .095);
        for (const z of [-10,0,10]) box(building, steel, x, 24.8, z, .07, 1.4, .07);
      }
    }
  }
  box(building, white, .5, 25.2, -2.5, 15.8, 2.4, 14);
  box(building, white, .5, 26.5, -2.5, 16.2, .18, 14.5);
  for (const x of [-3,0,3]) {
    const tank = cylinder(building, silver, x,27.15,-4,.7,.7,2,32);
    tank.rotation.z = Math.PI / 2;
    for (const dx of [-.65,.65]) {
      box(building, steel, x + dx,26.7,-4,.12,.4,1);
    }
  }
  for(let x=-53;x<56;x+=8) box(building,white,x,25.1,12, .3,2,.3);
  box(building,white,0,26.15,12,WIDTH,.22,.35);
  batch(building);

  return building;
}
