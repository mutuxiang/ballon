const path = require('node:path');

// Shared by every native window. Keep the artwork in public/brand for Vite too.
const APP_ID = 'com.mutuxiang.ballon';
const APP_NAME = '鼓足气';
const APP_NAME_EN = 'puffo-pump!';
const APP_ICON = path.join(__dirname, '../public/brand', process.platform === 'win32' ? 'app-icon.ico' : 'app-logo.png');
module.exports = { APP_ID, APP_ICON, APP_NAME, APP_NAME_EN };
