import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uvToPixel,stampDimensions} from '../src/fivem/paint-uv';

test('YFT UV maps onto PNG pixel coordinates with proper vertical flip',()=>{
 assert.deepEqual(uvToPixel(0,0,1024,512),{x:0,y:511});
 assert.deepEqual(uvToPixel(1,1,1024,512),{x:1023,y:0});
 assert.deepEqual(uvToPixel(.5,.5,1024,512),{x:512,y:256});
});
test('YFT UV outside 0..1 cannot silently paint wrong YTD texture',()=>{
 assert.throws(()=>uvToPixel(1.01,.5,1024,512),/poza zakresem/);
 assert.throws(()=>uvToPixel(-.01,.5,1024,512),/poza zakresem/);
 assert.throws(()=>uvToPixel(Number.NaN,.5,1024,512),/poza zakresem/);
 assert.throws(()=>uvToPixel(.5,.5,0,512),/wymiary/);
});
test('logo stamp keeps source aspect and enforces upload size limits',()=>{
 assert.deepEqual(stampDimensions(256,512,256),{width:256,height:128});
 assert.deepEqual(stampDimensions(128,256,512),{width:128,height:256});
 assert.throws(()=>stampDimensions(1,512,256),/8–2048/);
 assert.throws(()=>stampDimensions(4096,512,256),/8–2048/);
});
