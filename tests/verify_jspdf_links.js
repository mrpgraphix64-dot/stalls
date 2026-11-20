import { jsPDF } from 'jspdf';

const doc = new jsPDF();

doc.text('3D View', 10, 10);
doc.link(10, 10, 40, 6, { url: 'https://claude.site/artifacts/alpha-3d-view' });

doc.text('Print Files', 10, 20);
doc.link(10, 20, 40, 6, { url: 'https://drive.google.com/drive/folders/print_alpha_123' });

doc.text('Goodies', 10, 30);
doc.link(10, 30, 40, 6, { url: 'https://drive.google.com/drive/folders/goodies_alpha_456' });

const raw = doc.output();
const links = raw.match(/\/Subtype\s*\/Link/g);
const hasClaude = raw.includes('claude.site/artifacts/alpha-3d-view');
const hasPrint = raw.includes('print_alpha_123');
const hasGoodies = raw.includes('goodies_alpha_456');

console.log(JSON.stringify({
  linkCount: links ? links.length : 0,
  hasClaude,
  hasPrint,
  hasGoodies
}));
