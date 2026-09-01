const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');
code = code.replace(
  `const status = partnerState[1][0].status || 'online';`,
  `const status = (partnerState[1][0] as any).status || 'online';`
);
fs.writeFileSync('src/components/Dashboard.tsx', code);
