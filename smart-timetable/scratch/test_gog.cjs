const { execFileSync } = require('child_process');

const gogPath = '/opt/homebrew/bin/gog';
const calendarId = 'primary'; // Test with primary
const now = new Date();
const start = now.toISOString();
const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

const args = [
    'calendar', 'create', calendarId,
    '--summary', 'Test Event from Bot',
    '--location', 'Office',
    '--description', 'Testing gog CLI integration',
    '--from', start,
    '--to', end,
    '--json'
];

try {
    console.log(`Running: ${gogPath} ${args.join(' ')}`);
    const output = execFileSync(gogPath, args, { encoding: 'utf8' });
    console.log('Success!');
    console.log(output);
} catch (error) {
    console.error('Failed!');
    console.error(error.message);
    if (error.stderr) console.error(error.stderr);
}
