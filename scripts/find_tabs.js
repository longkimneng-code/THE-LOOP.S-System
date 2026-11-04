const fs = require('fs');
const path = require('path');

function walk(dir) {
  try {
    for (const file of fs.readdirSync(dir)) {
      if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.gemini') continue;
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('Monthly Financial History')) console.log('MFH in:', full);
        if (content.includes('Loop Share Management')) console.log('LSM in:', full);
        if (content.includes('Monthly Revenue Allocation')) console.log('MRA in:', full);
      }
    }
  } catch (e) {}
}

walk('.');

