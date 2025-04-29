const fs = require('fs');

// Read the file
let content = fs.readFileSync('server/routes.ts', 'utf8');

// Replace the lines that handle the countryInfo synchronously with async calls
content = content.replace(/const countryInfo = getCountryCode\(req\);/g, 'const countryInfo = await getCountryCode(req);');

// Write the file back
fs.writeFileSync('server/routes.ts', content);

console.log('Fixed async geolocation calls');
