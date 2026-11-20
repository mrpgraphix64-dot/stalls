import assert from 'node:assert';

function parseWallConfig(raw) {
  if (!raw || typeof raw !== 'string') {
    return {
      type: 'unconfigured',
      label: 'Not Configured',
      shortLabel: '—',
      tooltip: 'Wall configuration not configured',
      isConfigured: false,
    };
  }

  const s = raw.trim().toLowerCase();

  if (s === '3 sides' || s === '3sides' || s.includes('3 side')) {
    return {
      type: '3_sides',
      label: '3 Sides',
      shortLabel: '3 Sides',
      tooltip: '3 Sides — Back + Left + Right (Open Front)',
      isConfigured: true,
    };
  }

  if (s.includes('right') || s === 'back + right' || s === '2 sides - right') {
    return {
      type: '2_sides_right',
      label: 'Back + Right',
      shortLabel: 'Back + Right',
      tooltip: '2 Sides — Back + Right (Corner Stall)',
      isConfigured: true,
    };
  }

  if (s.includes('left') || s === 'back + left' || s === '2 sides - left') {
    return {
      type: '2_sides_left',
      label: 'Back + Left',
      shortLabel: 'Back + Left',
      tooltip: '2 Sides — Back + Left (Corner Stall)',
      isConfigured: true,
    };
  }

  if (s.includes('back wall') || s.includes('back only') || s === 'back wall only') {
    return {
      type: 'back_only',
      label: 'Back Wall Only',
      shortLabel: 'Back Wall',
      tooltip: 'Back Wall Only (3 Open Sides)',
      isConfigured: true,
    };
  }

  if (s.includes('2 side')) {
    return {
      type: '2_sides_left',
      label: '2 Sides',
      shortLabel: '2 Sides',
      tooltip: '2 Sides — Back + Side Wall',
      isConfigured: true,
    };
  }

  return {
    type: 'unconfigured',
    label: 'Not Configured',
    shortLabel: '—',
    tooltip: 'Wall configuration not configured',
    isConfigured: false,
  };
}

console.log('Testing BoothWallIndicator parseWallConfig logic...');

// Test 1: 3 Sides
const t1 = parseWallConfig('3 Sides');
assert.strictEqual(t1.type, '3_sides');
assert.strictEqual(t1.shortLabel, '3 Sides');
assert.strictEqual(t1.isConfigured, true);
console.log('  [PASS] 3 Sides configuration');

// Test 2: 2 Sides Back + Left
const t2 = parseWallConfig('Back + Left');
assert.strictEqual(t2.type, '2_sides_left');
assert.strictEqual(t2.shortLabel, 'Back + Left');
assert.strictEqual(t2.isConfigured, true);
console.log('  [PASS] 2 Sides Back + Left configuration');

// Test 3: 2 Sides Back + Right
const t3 = parseWallConfig('Back + Right');
assert.strictEqual(t3.type, '2_sides_right');
assert.strictEqual(t3.shortLabel, 'Back + Right');
assert.strictEqual(t3.isConfigured, true);
console.log('  [PASS] 2 Sides Back + Right configuration');

// Test 4: Back Wall Only
const t4 = parseWallConfig('Back Wall Only');
assert.strictEqual(t4.type, 'back_only');
assert.strictEqual(t4.shortLabel, 'Back Wall');
assert.strictEqual(t4.isConfigured, true);
console.log('  [PASS] Back Wall Only configuration');

// Test 5: Unset / NULL / Empty
const t5a = parseWallConfig(null);
assert.strictEqual(t5a.type, 'unconfigured');
assert.strictEqual(t5a.shortLabel, '—');
assert.strictEqual(t5a.isConfigured, false);

const t5b = parseWallConfig('');
assert.strictEqual(t5b.type, 'unconfigured');
assert.strictEqual(t5b.shortLabel, '—');
assert.strictEqual(t5b.isConfigured, false);

const t5c = parseWallConfig(undefined);
assert.strictEqual(t5c.type, 'unconfigured');
assert.strictEqual(t5c.shortLabel, '—');
assert.strictEqual(t5c.isConfigured, false);
console.log('  [PASS] Unset/NULL/empty returns unconfigured dash');

console.log('ALL BOOTH WALL INDICATOR UNIT TESTS PASSED!');
