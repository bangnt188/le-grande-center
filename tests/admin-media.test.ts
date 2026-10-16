import assert from "node:assert/strict";
import test from "node:test";
import { PhotonImage } from "@cf-wasm/photon";
import { boundedMultipart, byteRange, fileType, imageDimensions, MAX_BATCH_BYTES, MediaError, mediaHeaders } from "../src/server/media/validation";
import { prepareFiles } from "../src/server/media/prepare";
import { decodeMediaRows } from "../src/server/media/repository";

function raster(mime:string) {
  const image=new PhotonImage(new Uint8Array([20,100,40,255]),1,1);
  try { return new Uint8Array(mime==='image/png'?image.get_bytes():mime==='image/jpeg'?image.get_bytes_jpeg(90):image.get_bytes_webp()); } finally {image.free();}
}
test("raster uploads are decoded/reencoded; PDF bytes stay unchanged and are not marked clean",async()=>{
  for(const mime of ['image/png','image/jpeg','image/webp']) {
    const bytes=raster(mime);assert.deepEqual(imageDimensions(bytes,mime),{width:1,height:1});
    const [result]=await prepareFiles([new File([bytes],"logo",{type:mime})]);
    assert.equal(result.provider,'neon');assert.equal(result.scan,'clean');assert.equal(result.mime,mime);assert.match(result.sha256,/^[a-f0-9]{64}$/);
    const decoded=PhotonImage.new_from_byteslice(result.bytes);assert.equal(decoded.get_width(),1);assert.equal(decoded.get_height(),1);decoded.free();
  }
  const original=new TextEncoder().encode('%PDF-1.7\nuser supplied original\n%%EOF');
  const [document]=await prepareFiles([new File([original],'original.pdf',{type:'application/pdf'})]);
  assert.equal(document.provider,'r2');assert.equal(document.scan,'pending');assert.deepEqual(document.bytes,original);
  const input=raster('image/png'), trailing=new Uint8Array(input.length+15);trailing.set(input);trailing.set(new TextEncoder().encode('<script>x</script>').subarray(0,15),input.length);
  const [sanitized]=await prepareFiles([new File([trailing],'logo.png',{type:'image/png'})]);
  assert.equal(new TextDecoder().decode(sanitized.bytes).includes('<script>'),false);
});
test("header spoofing, decompression bombs, empty files and oversized batches fail closed",async()=>{
  assert.throws(()=>fileType(new TextEncoder().encode('<svg/>'),'image/png'),MediaError);
  const bomb=raster('image/png');new DataView(bomb.buffer).setUint32(16,100000);
  assert.throws(()=>imageDimensions(bomb,'image/png'),MediaError);
  await assert.rejects(prepareFiles([new File([],'empty.pdf',{type:'application/pdf'})]),MediaError);
  await assert.rejects(boundedMultipart(new Request('https://example.test/api/admin/media',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=a','content-length':String(MAX_BATCH_BYTES+65537)},body:'x'})),{status:413});
  const form=new FormData();form.append('files',new File(['%PDF-1.7'],'a.pdf',{type:'application/pdf'}));form.set('scope','Toàn dự án');form.set('expectedRevision','0');
  const parsed=await boundedMultipart(new Request('https://example.test/api/admin/media',{method:'POST',body:form}));assert.equal(parsed.files.length,1);assert.equal(parsed.expectedRevision,0);
  form.append('expectedRevision','1');await assert.rejects(boundedMultipart(new Request('https://example.test/api/admin/media',{method:'POST',body:form})),MediaError);
});
test("single byte ranges and private response policy are exact",()=>{
  assert.deepEqual(byteRange('bytes=2-4',10),{offset:2,length:3});assert.deepEqual(byteRange('bytes=-3',10),{offset:7,length:3});assert.deepEqual(byteRange('bytes=8-',10),{offset:8,length:2});assert.deepEqual(byteRange('bytes=0-99',10),{offset:0,length:10});
  for(const value of ['bytes=10-','bytes=4-2','bytes=-0','bytes=0-1,3-4','bytes=999999999999999999-'])assert.throws(()=>byteRange(value,10),{status:416});
  const headers=mediaHeaders('application/pdf','hợp đồng.pdf',10,{offset:2,length:3});
  assert.equal(headers.get('content-range'),'bytes 2-4/10');assert.equal(headers.get('content-length'),'3');assert.equal(headers.get('cache-control'),'private, no-store');assert.equal(headers.get('x-content-type-options'),'nosniff');assert.match(headers.get('content-security-policy')!,/^sandbox;/);
});

test("reviewed media retains its release timestamp after JSON aggregation", () => {
  const [media] = decodeMediaRows([{
    id: "5b085f24-c486-4464-b081-e095a7d6ea9c", title: "Reviewed PDF",
    content_type: "application/pdf", media_scope: "Toàn dự án", byte_size: "629",
    state: "ready", public_url: null, manual_reviewed_at: "2026-10-15T11:18:04.984+00:00",
  }], true);
  assert.equal(JSON.parse(JSON.stringify(media)).reviewedAt, "2026-10-15T11:18:04.984Z");
  assert.equal(media.uploadState, "ready");
});
