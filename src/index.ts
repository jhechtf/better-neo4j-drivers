import { HANDSHAKE, VERSIONS } from './handshake';

// HOLDING
// const bob = new WebSocket('ws://localhost:7687');
// bob.addEventListener('error', (e) => {
//   console.info('uh oh', e);
// });
// bob.addEventListener('open', () => {
//   const b = new Blob()
//   const initialListener: (e: MessageEvent) => void = async (e) => {
    

//     console.info('S:', e.data);
//     if(e.data instanceof Blob) {
//       const decoded = await e.data.arrayBuffer();
//       const v = new Uint8Array(decoded);
//       console.info(v);
//       bob.send(Uint8Array.from([0x01]))
//       bob.removeEventListener('message', initialListener);
//     }
//   };
//   bob.addEventListener('message', initialListener);
//   // bob.addEventListener('message', async (e) => {
//   //   console.info('SS: ', e.data);
//   // })
//   bob.send(HANDSHAKE);
//   bob.send(VERSIONS);
// });

// bob.addEventListener('close', (e) => {
//   console.info('closing connection', e);
// })

export default {}