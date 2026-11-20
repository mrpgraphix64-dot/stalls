import assert from 'node:assert';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function normalizeBoothNumber(str) {
  if (!str) return '';
  return str.trim().replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');
}

function isPendingOrEmpty(val) {
  if (!val) return true;
  const s = val.trim().toLowerCase();
  return (
    s === '' ||
    s === 'pending' ||
    s === 'tbd' ||
    s === 'n/a' ||
    s === '-' ||
    s === 'not assigned' ||
    s === 'unassigned' ||
    s === 'none'
  );
}

function compareBoothNumbers(aNum, bNum, direction = 'asc') {
  const aEmpty = isPendingOrEmpty(aNum);
  const bEmpty = isPendingOrEmpty(bNum);

  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const aNorm = normalizeBoothNumber(aNum);
  const bNorm = normalizeBoothNumber(bNum);

  const cmp = collator.compare(aNorm, bNorm);
  return direction === 'asc' ? cmp : -cmp;
}

function sortBoothsByNumber(booths, direction = 'asc') {
  return [...booths].sort((a, b) => {
    const cmp = compareBoothNumbers(a.booth_number, b.booth_number, direction);
    if (cmp !== 0) return cmp;

    const nameA = (a.client_name || '').trim();
    const nameB = (b.client_name || '').trim();
    const nameCmp = collator.compare(nameA, nameB);
    if (nameCmp !== 0) return nameCmp;

    return (a.id || '').localeCompare(b.id || '');
  });
}

console.log('Testing booth natural sorting in node...');

// 1. Dash normalization
assert.strictEqual(normalizeBoothNumber('A36–A37'), 'A36-A37'); // en-dash
assert.strictEqual(normalizeBoothNumber('B1—B2'), 'B1-B2'); // em-dash

// 2. Pending check
assert.strictEqual(isPendingOrEmpty('Pending'), true);
assert.strictEqual(isPendingOrEmpty('pending'), true);
assert.strictEqual(isPendingOrEmpty(''), true);
assert.strictEqual(isPendingOrEmpty(null), true);
assert.strictEqual(isPendingOrEmpty('A2'), false);

// 3. User requirement exact example: A2, A9, A24, A35, A39, A119, A135
const userSample = [
  { id: '1', booth_number: 'A135' },
  { id: '2', booth_number: 'A2' },
  { id: '3', booth_number: 'A119' },
  { id: '4', booth_number: 'A39' },
  { id: '5', booth_number: 'A24' },
  { id: '6', booth_number: 'A9' },
  { id: '7', booth_number: 'A35' },
];

const sortedAsc = sortBoothsByNumber(userSample, 'asc');
assert.deepStrictEqual(
  sortedAsc.map((b) => b.booth_number),
  ['A2', 'A9', 'A24', 'A35', 'A39', 'A119', 'A135'],
  'User sample ascending sort mismatch'
);

const sortedDesc = sortBoothsByNumber(userSample, 'desc');
assert.deepStrictEqual(
  sortedDesc.map((b) => b.booth_number),
  ['A135', 'A119', 'A39', 'A35', 'A24', 'A9', 'A2'],
  'User sample descending sort mismatch'
);

// 4. Combined booth numbers & prefixes
const complexSample = [
  { id: '10', booth_number: 'D-05' },
  { id: '1', booth_number: 'A36–A37' },
  { id: '2', booth_number: 'B2' },
  { id: '3', booth_number: 'A35' },
  { id: '4', booth_number: 'B10' },
  { id: '5', booth_number: 'C1' },
  { id: '6', booth_number: 'B1' },
  { id: '7', booth_number: 'A39' },
  { id: '8', booth_number: 'Pending' },
  { id: '9', booth_number: '' },
];

const complexAsc = sortBoothsByNumber(complexSample, 'asc').map((b) => b.booth_number);
assert.deepStrictEqual(
  complexAsc,
  ['A35', 'A36–A37', 'A39', 'B1', 'B2', 'B10', 'C1', 'D-05', 'Pending', '']
);

const complexDesc = sortBoothsByNumber(complexSample, 'desc').map((b) => b.booth_number);
assert.deepStrictEqual(
  complexDesc,
  ['D-05', 'C1', 'B10', 'B2', 'B1', 'A39', 'A36–A37', 'A35', 'Pending', '']
);

// 5. Stability test: original array not mutated
const originalClone = [...userSample];
sortBoothsByNumber(userSample, 'asc');
assert.deepStrictEqual(userSample, originalClone, 'Original array was mutated');

console.log('ALL 5 BOOTH SORTING TESTS PASSED (100% OK)!');
