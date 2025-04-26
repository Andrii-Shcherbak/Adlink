const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'server/routes.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the require statements
content = content.replace(/const { servePdfDocument } = require\(['"]\.\/pdf-handler['"]\);/g, 
  '// servePdfDocument is already imported at the top of the file');

fs.writeFileSync(filePath, content);
console.log('Fixed routes.ts file');
