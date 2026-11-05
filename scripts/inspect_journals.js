const fs = require('fs');
const state = JSON.parse(fs.readFileSync('account_system_Loops/backend/data/loops_finance_state.json', 'utf8'));

console.log('--- ALL JOURNAL ENTRIES IN LOOPS FINANCE ---');
state.journalEntries.forEach((j, i) => {
  const revLine = (j.lines || []).find(l => l.accountCode === '4010');
  const amount = revLine ? revLine.credit : (j.lines[0]?.debit || 0);
  console.log(`${i + 1}. [${j.sourceType}] id:${j.id} | amt:$${amount} | memo:${j.memo}`);
});

const totalRev = state.journalEntries.reduce((sum, j) => {
  const l = (j.lines || []).find(line => line.accountCode === '4010');
  return sum + (l ? l.credit : 0);
}, 0);
console.log('\nTOTAL REVENUE IN GENERAL LEDGER (ACCOUNT 4010): $' + totalRev.toFixed(2));

