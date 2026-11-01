/* Tap the game's actual Web Audio output without changing its audible graph. */
(() => {
  'use strict';
  const connect = AudioNode.prototype.connect, connected = new WeakSet();
  let recorder, stream, start, end, error;
  const chunks=[];
  AudioNode.prototype.connect = function(destination, ...args) {
    const result = connect.call(this, destination, ...args);
    if(destination===this.context.destination && !connected.has(this)) {
      try {
        if(!stream) {
          stream=this.context.createMediaStreamDestination();
          recorder=new MediaRecorder(stream.stream,{mimeType:'audio/webm;codecs=opus'});
          recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
          start=Date.now();recorder.start(1000);
        }
        connect.call(this,stream,args[0]||0);connected.add(this);
      } catch(e) {error=String(e);}
    }
    return result;
  };
  window.gameAudio={
    async stop() {
      if(!recorder)return {error:error||'Game created no audio output'};
      await new Promise(resolve=>{recorder.onstop=resolve;end=Date.now();recorder.stop();});
      const blob=new Blob(chunks,{type:'audio/webm'}),bytes=new Uint8Array(await blob.arrayBuffer());
      // Chunk conversion avoids exhausting the JS argument stack on long recordings.
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return {base64:btoa(binary),start,end,error:error||null};
    }
  };
})();
