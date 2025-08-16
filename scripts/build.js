#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🏗️  Building MummyHelp Backend for Production...');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('✅ Created dist directory');
}

// Copy necessary files to dist
const filesToCopy = [
  'server.js',
  'package.json',
  'package-lock.json',
  '.env.production'
];

filesToCopy.forEach(file => {
  const sourcePath = path.join(__dirname, '..', file);
  const destPath = path.join(distDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied ${file}`);
  } else {
    console.log(`⚠️  Warning: ${file} not found`);
  }
});

// Copy directories
const dirsToCopy = [
  'routes',
  'models',
  'middleware',
  'config',
  'services'
];

dirsToCopy.forEach(dir => {
  const sourcePath = path.join(__dirname, '..', dir);
  const destPath = path.join(distDir, dir);
  
  if (fs.existsSync(sourcePath)) {
    copyDirectory(sourcePath, destPath);
    console.log(`✅ Copied ${dir} directory`);
  }
});

function copyDirectory(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  const items = fs.readdirSync(source);
  
  items.forEach(item => {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  });
}

console.log('🎉 Build completed successfully!');
console.log('📁 Production files are in the dist/ directory');
console.log('🚀 To deploy:');
console.log('   1. Copy dist/ contents to your server');
console.log('   2. Run: npm install --production');
console.log('   3. Set NODE_ENV=production');
console.log('   4. Start with: npm start');
