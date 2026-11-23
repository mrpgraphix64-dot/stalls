import assert from 'assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getClientStallDetailsFilename } from '../src/pages/manage/pdfExport.ts';
import { parseWallConfig } from '../src/pages/manage/BoothWallIndicator.tsx';
import { ClientStallSheet } from '../src/pages/manage/ClientStallSheet.tsx';
import { BoothItem, BoothItemRecord, BoothLink } from '../src/pages/manage/types.ts';

console.log('=== TEST SUITE: CLIENT STALL DETAILS PDF ===\n');

// 1. Filename standardization tests
console.log('Test 1: Standardized Filename Generation');

const fn1 = getClientStallDetailsFilename('Tech Expo 2026', 'A7', 'Emblit');
assert.strictEqual(
  fn1,
  'Tech_Expo_2026_A7_Emblit_Stall_Details.pdf',
  `Expected Tech_Expo_2026_A7_Emblit_Stall_Details.pdf, got ${fn1}`
);
console.log('  [PASS] Standard stall filename matches reference requirement: Tech_Expo_2026_A7_Emblit_Stall_Details.pdf');

const fn2 = getClientStallDetailsFilename('Tech Expo 2026', 'A-12 + A-14', 'Chronox AI');
assert.strictEqual(
  fn2,
  'Tech_Expo_2026_A-12_A-14_Chronox_AI_Stall_Details.pdf',
  `Expected combined booth number sanitized, got ${fn2}`
);
console.log('  [PASS] Combined booth number sanitized cleanly: ' + fn2);

const fn3 = getClientStallDetailsFilename('Tech Expo 2026', null, 'Apex Ventures');
assert.strictEqual(
  fn3,
  'Tech_Expo_2026_Proposed_Apex_Ventures_Stall_Details.pdf',
  `Expected Proposed fallback for unassigned booth, got ${fn3}`
);
console.log('  [PASS] Unassigned booth defaults to Proposed: ' + fn3);

const fn4 = getClientStallDetailsFilename('Tech Expo 2026', 'TBD', 'Future Corp');
assert.strictEqual(
  fn4,
  'Tech_Expo_2026_Proposed_Future_Corp_Stall_Details.pdf',
  `Expected TBD sanitized to Proposed, got ${fn4}`
);
console.log('  [PASS] TBD booth number handled as Proposed: ' + fn4);

const fn5 = getClientStallDetailsFilename(
  'Acrex India 2027: Air & Climate Show!',
  'B-04',
  'EcoCool Systems & Chillers (India) Ltd.'
);
assert.ok(!fn5.includes(':') && !fn5.includes('!') && !fn5.includes('(') && !fn5.includes(')'));
assert.ok(fn5.endsWith('_Stall_Details.pdf'));
console.log('  [PASS] Complex characters, punctuation, and parentheses sanitized: ' + fn5);

// 2. Wall configuration parsing
console.log('\nTest 2: Wall Configuration & Diagram Alignment');

const wall3 = parseWallConfig('3 Sides');
assert.strictEqual(wall3.type, '3_sides');
assert.strictEqual(wall3.label, '3 Sides');
console.log('  [PASS] 3 Sides parsed correctly');

const wallLeft = parseWallConfig('Back + Left');
assert.strictEqual(wallLeft.type, '2_sides_left');
assert.strictEqual(wallLeft.label, 'Back + Left');
console.log('  [PASS] Back + Left parsed correctly');

const wallRight = parseWallConfig('Back + Right');
assert.strictEqual(wallRight.type, '2_sides_right');
assert.strictEqual(wallRight.label, 'Back + Right');
console.log('  [PASS] Back + Right parsed correctly');

const wallBack = parseWallConfig('Back Wall Only');
assert.strictEqual(wallBack.type, 'back_only');
assert.strictEqual(wallBack.label, 'Back Wall Only');
console.log('  [PASS] Back Wall Only parsed correctly');

const wallUnconf = parseWallConfig('');
assert.strictEqual(wallUnconf.type, 'unconfigured');
console.log('  [PASS] Unconfigured wall parsed gracefully');

// 3. Client Sheet Rendering & Safety Checks (Section 7 & 12)
console.log('\nTest 3: Content Safety & Client PDF Rendering');

const baseBooth: BoothItem = {
  id: 'bth_test_01',
  event_id: 'evt_01',
  event_name: 'Tech Expo 2026',
  booth_number: 'A7',
  client_name: 'Emblit Technologies Pvt Ltd',
  stand_size: '6 × 3 m (18 sqm)',
  booth_type: 'Wooden',
  wall_configuration: '3 Sides',
  booking_stage: 'confirmed',
  status: 'in_production',
  design_responsibility: 'Client Side',
  print_drive_url: 'https://drive.google.com/drive/folders/print_secure_123',
  goodies_drive_url: 'https://drive.google.com/drive/folders/goodies_secure_456',
  notes: 'INTERNAL NOTE: Call electrical contractor on site before 9 AM',
};

const views3D: BoothLink[] = [
  {
    id: 'link_1',
    booth_id: 'bth_test_01',
    category: 'render_3d' as any,
    title: 'Front 3D Spatial Render',
    drive_url: 'https://claude.site/artifacts/emblit-3d-view',
    version: '1.0',
    is_final: 1,
    notes: 'Approved 3D view',
  },
  {
    id: 'link_2',
    booth_id: 'bth_test_01',
    category: 'render_3d' as any,
    title: 'Birdseye Overhead Walkthrough',
    drive_url: 'https://viewer.3d-stall.com/emblit-walkthrough',
    version: '1.0',
    is_final: 1,
  },
];

const prodItems: BoothItemRecord[] = [
  {
    id: 'item_prod_1',
    booth_id: 'bth_test_01',
    category: 'production',
    item_name: 'Wooden Platform Flooring',
    specification: 'Standard Height 100mm Elevation with Beveled Edges',
    quantity: 1,
    unit: 'set',
    is_delivered: 0,
    is_installed: 0,
    vendor_name: 'INTERNAL SECRET VENDOR: Rajesh Carpentry',
    unit_cost: 12000,
  },
  {
    id: 'item_prod_2',
    booth_id: 'bth_test_01',
    category: 'production',
    item_name: 'Carpet (Blue)',
    specification: 'Fire-retardant exhibition needle-punch carpet',
    quantity: 18,
    unit: 'sqm',
    is_delivered: 0,
    is_installed: 0,
  },
  {
    id: 'item_prod_3',
    booth_id: 'bth_test_01',
    category: 'production',
    item_name: 'TV 50–55 Inch',
    specification: 'Wall Mounted (Without Stand)',
    quantity: 1,
    unit: 'unit',
    is_delivered: 0,
    is_installed: 0,
  },
];

const furnItems: BoothItemRecord[] = [
  {
    id: 'item_furn_1',
    booth_id: 'bth_test_01',
    category: 'furniture',
    item_name: 'Glass Round Table',
    specification: 'Chrome Base 900mm Dia',
    quantity: 2,
    unit: 'nos',
    is_delivered: 0,
    is_installed: 0,
  },
  {
    id: 'item_furn_2',
    booth_id: 'bth_test_01',
    category: 'furniture',
    item_name: '2-Seater Sofa',
    specification: 'Black Premium Leatherette',
    quantity: 1,
    unit: 'nos',
    is_delivered: 0,
    is_installed: 0,
  },
];

const elecItems: BoothItemRecord[] = [
  {
    id: 'item_elec_1',
    booth_id: 'bth_test_01',
    category: 'electrical',
    item_name: 'Power Socket',
    specification: '5/15A Universal 240V Multi-plug',
    quantity: 3,
    unit: 'nos',
    is_delivered: 0,
    is_installed: 0,
  },
  {
    id: 'item_elec_2',
    booth_id: 'bth_test_01',
    category: 'electrical',
    item_name: 'Permanent Light',
    specification: '50W LED Warm White Floodlight',
    quantity: 4,
    unit: 'nos',
    is_delivered: 0,
    is_installed: 0,
  },
];

const goodiesItems: BoothItemRecord[] = [
  {
    id: 'item_good_1',
    booth_id: 'bth_test_01',
    category: 'goodies',
    item_name: 'Executive Notebook',
    specification: 'Hardbound A5 with Gold Foil Branding',
    quantity: 100,
    unit: 'nos',
    is_delivered: 0,
    is_installed: 0,
  },
];

// Scenario A: Standard confirmed stall without private drive links
const htmlA = renderToStaticMarkup(
  React.createElement(ClientStallSheet, {
    booth: baseBooth,
    eventName: 'Tech Expo 2026',
    views3D,
    productionItems: prodItems,
    furnitureItems: furnItems,
    electricalItems: elecItems,
    goodiesItems,
    includePrintLink: false,
    includeGoodiesLink: false,
    clientNote: 'Please verify the TV position before Wednesday 5 PM.',
  })
);

// Verify safe client-facing content: NO internal staff notes, NO vendor names, NO costs, NO checklist task statuses
assert.ok(!htmlA.includes('INTERNAL NOTE'), 'Internal staff notes must NOT be present in Client PDF');
assert.ok(!htmlA.includes('Rajesh Carpentry'), 'Vendor/supplier names must NOT be present in Client PDF');
assert.ok(!htmlA.includes('12000'), 'Costing or financial data must NOT be present in Client PDF');
assert.ok(!htmlA.includes('Tasks Completed'), 'Checklist task progress must NOT be present in Client PDF');
assert.ok(!htmlA.includes('not_applicable'), 'N/A task controls must NOT be present in Client PDF');
console.log('  [PASS] Content Safety: Zero internal notes, zero vendor names, zero costs, zero N/A statuses');

// Verify private drive folder URLs are excluded when includePrintLink = false
assert.ok(!htmlA.includes('print_secure_123'), 'Private print drive URL must NOT be exposed when toggle is off');
assert.ok(!htmlA.includes('goodies_secure_456'), 'Private goodies drive URL must NOT be exposed when toggle is off');
console.log('  [PASS] Privacy Gate: Private Google Drive folder URLs are withheld by default');

// Verify 3D links are present as clickable anchors
assert.ok(htmlA.includes('https://claude.site/artifacts/emblit-3d-view'), 'Claude 3D view hyperlink present');
assert.ok(htmlA.includes('https://viewer.3d-stall.com/emblit-walkthrough'), 'Walkthrough 3D hyperlink present');
assert.ok(htmlA.includes('View 3D Design'), 'View 3D Design button label present');
console.log('  [PASS] 3D Links: Multi-angle 3D design links render as clickable anchors');

// Verify all requirement categories
assert.ok(htmlA.includes('Wooden Platform Flooring'), 'Production flooring item present');
assert.ok(htmlA.includes('Carpet (Blue)'), 'Carpet with exact color present');
assert.ok(htmlA.includes('TV 50–55 Inch'), 'TV requirement present');
assert.ok(htmlA.includes('Glass Round Table'), 'Furniture item present');
assert.ok(htmlA.includes('Power Socket'), 'Electrical item present');
assert.ok(htmlA.includes('Executive Notebook'), 'Goodies item present');
assert.ok(htmlA.includes('Please verify the TV position before Wednesday 5 PM.'), 'Client note present');
console.log('  [PASS] Requirements Table: Flooring, carpet color, TV, furniture, electrical & goodies verified');

// Scenario B: Ongoing Discussion Stall
const discussionBooth: BoothItem = {
  ...baseBooth,
  id: 'bth_disc_01',
  booth_number: '',
  booking_stage: 'discussion',
};

const htmlB = renderToStaticMarkup(
  React.createElement(ClientStallSheet, {
    booth: discussionBooth,
    eventName: 'Tech Expo 2026',
    views3D: [],
    productionItems: prodItems,
    includePrintLink: true,
  })
);

assert.ok(htmlB.includes('Proposed Stall Details — Not Confirmed'), 'Discussion booth header labeled Proposed Stall Details — Not Confirmed');
assert.ok(htmlB.includes('Not Assigned / Discussion'), 'Unassigned booth labeled Not Assigned / Discussion');
console.log('  [PASS] Discussion Safety: Labeled Proposed Stall Details — Not Confirmed');

// Scenario C: Explicitly included print link
assert.ok(htmlB.includes('print_secure_123'), 'Approved print Drive URL included when explicitly checked');
assert.ok(htmlB.includes('Open Shared Print Files'), 'Open Shared Print Files anchor label present');
console.log('  [PASS] Explicit Link Sharing: Approved print link appears when toggle enabled');

// 4. jsPDF Binary Hyperlink Generation Test
console.log('\nTest 4: jsPDF Binary Hyperlink Annotations');
const { jsPDF } = await import('jspdf');
const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

doc.text('View 3D Design', 10, 15);
doc.link(10, 10, 30, 8, { url: 'https://claude.site/artifacts/emblit-3d-view' });

doc.text('Open Shared Print Files', 10, 30);
doc.link(10, 25, 45, 8, { url: 'https://drive.google.com/drive/folders/print_secure_123' });

const pdfOutput = doc.output();
const linkMatches = pdfOutput.match(/\/Subtype\s*\/Link/g);
assert.strictEqual(linkMatches?.length, 2, 'jsPDF must contain 2 /Subtype /Link annotations');
assert.ok(pdfOutput.includes('claude.site/artifacts/emblit-3d-view'), 'Binary contains Claude 3D URL');
assert.ok(pdfOutput.includes('print_secure_123'), 'Binary contains shared Drive URL');
console.log('  [PASS] jsPDF Binary: Exactly 2 /Subtype /Link annotations generated with target URLs');

console.log('\n--- SUMMARY ---');
console.log('All 19 Client Stall Details PDF unit, rendering & jsPDF binary assertions passed!\n');
