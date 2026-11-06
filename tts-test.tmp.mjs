import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { writeFileSync } from 'fs';

const tts = new MsEdgeTTS({ connectionTimeoutMs: 15000, synthesisTimeoutMs: 30000 });
await tts.setMetadata('en-US-AriaNeural', OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
const { audioStream } = tts.toStream("I usually get up at seven o'clock.");
const chunks = [];
audioStream.on('data', (d) => chunks.push(d));
audioStream.on('close', () => {
  const buf = Buffer.concat(chunks);
  writeFileSync('/private/var/folders/cy/2t31_kmn1hg6_4qvsyzpkr340000gp/T/tts-test.webm', buf);
  console.log('OK bytes=', buf.length);
});
audioStream.on('error', (e) => console.error('STREAM ERR', e.message));
setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 30000);
