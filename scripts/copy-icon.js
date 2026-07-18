const fs = require('fs');
const path = require('path');

const sourceIcon = "C:\\Users\\dell\\.gemini\\antigravity\\brain\\8ff291f9-6638-4171-ab8d-48dbacdb6d4b\\autotrack_app_icon_1784366309289.png";

const targets = [
  path.join(__dirname, '../assets/images/icon.png'),
  path.join(__dirname, '../assets/images/android-icon-foreground.png'),
  path.join(__dirname, '../assets/images/splash-icon.png')
];

function copyIcon() {
  if (!fs.existsSync(sourceIcon)) {
    console.error(`Source icon not found at: ${sourceIcon}`);
    return;
  }

  targets.forEach(target => {
    try {
      // Ensure target directory exists
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.copyFileSync(sourceIcon, target);
      console.log(`Copied icon successfully to: ${target}`);
    } catch (err) {
      console.error(`Error copying to ${target}:`, err);
    }
  });
}

copyIcon();
