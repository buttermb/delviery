const REALISTIC_NAMES = [
  { first: 'Sarah', last: 'M.' },
  { first: 'Mike', last: 'R.' },
  { first: 'Jessica', last: 'L.' },
  { first: 'David', last: 'K.' },
  { first: 'Emily', last: 'W.' },
  { first: 'Chris', last: 'P.' },
  { first: 'Amanda', last: 'S.' },
  { first: 'Tyler', last: 'B.' },
  { first: 'Nicole', last: 'H.' },
  { first: 'Brandon', last: 'G.' }
];

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx'];

function generateRealisticEntry() {
  const person = REALISTIC_NAMES[Math.floor(Math.random() * REALISTIC_NAMES.length)];
  
  const entryCounts = [1, 1, 1, 2, 2, 3, 5, 8];
  const entries = entryCounts[Math.floor(Math.random() * entryCounts.length)];
  
  const secondsAgo = Math.floor(Math.random() * 270) + 30;
  const timestamp = secondsAgo < 60 ? 'just now' : `${Math.floor(secondsAgo / 60)} minutes ago`;
  
  return {
    name: `${person.first} ${person.last}`,
    borough: BOROUGHS[Math.floor(Math.random() * BOROUGHS.length)],
    entries,
    timestamp
  };
}

export function mixRealAndGeneratedEntries(realEntries: any[], count = 10) {
  const entries = [...realEntries];
  
  while (entries.length < count) {
    entries.push(generateRealisticEntry());
  }
  
  return entries.slice(0, count);
}
