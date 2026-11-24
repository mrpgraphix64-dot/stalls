import QRCode from 'qrcode';

async function testQRs() {
  const gdriveUrl = 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789?usp=sharing';
  const claude3dUrl = 'https://claude.site/artifacts/test-3d-model-stall-101';
  
  const qr1 = await QRCode.toDataURL(gdriveUrl, { margin: 1, width: 200, errorCorrectionLevel: 'M' });
  const qr2 = await QRCode.toDataURL(claude3dUrl, { margin: 1, width: 200, errorCorrectionLevel: 'M' });
  
  const success = qr1.startsWith('data:image/png;base64,') && qr2.startsWith('data:image/png;base64,');
  console.log(JSON.stringify({ success, qr1Len: qr1.length, qr2Len: qr2.length }));
}

testQRs().catch(err => {
  console.error(err);
  process.exit(1);
});
