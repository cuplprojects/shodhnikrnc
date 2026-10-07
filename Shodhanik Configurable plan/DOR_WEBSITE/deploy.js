import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Configuration
const FTP_PATH_LIVETEST = '\\\\192.168.1.27\\e\\Hosted Applications\\SHODHANIK\\DOR';
const FTP_PATH_PRODUCTION = '\\\\192.168.1.24\\e\\hosted apps\\SHODHANIK\\DOR';
const BUILD_DIR = path.join(__dirname, 'dist');

// Determine FTP path based on VITE_APP_STAGE
const STAGE = process.env.VITE_APP_STAGE;
let FTP_PATH;

if (STAGE === 'production') {
  FTP_PATH = FTP_PATH_PRODUCTION;
  console.log('🎯 Deployment target: PRODUCTION');
} else if (STAGE === 'livetest') {
  FTP_PATH = FTP_PATH_LIVETEST;
  console.log('🎯 Deployment target: LIVETEST');
} else {
  console.error('❌ Invalid VITE_APP_STAGE. Must be "livetest" or "production"');
  console.error(`   Current value: ${STAGE || 'undefined'}`);
  process.exit(1);
}

console.log('🚀 Starting deployment process...');

try {
  // Step 1: Build the project
  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Build completed successfully!');

  // Step 2: Check if build directory exists
  if (!fs.existsSync(BUILD_DIR)) {
    throw new Error('Build directory not found. Build may have failed.');
  }

  // Step 2.5: Create web.config for IIS routing
  console.log('📝 Creating web.config for IIS...');
  createWebConfig(BUILD_DIR);
  console.log('✅ web.config created successfully!');

  // Step 3: Deploy to FTP server
  console.log('🌐 Deploying to server...');

  // Check if FTP path is accessible
  if (!fs.existsSync(FTP_PATH)) {
    throw new Error(`FTP path not accessible: ${FTP_PATH}`);
  }

  // Copy files to FTP location
  copyDirectory(BUILD_DIR, FTP_PATH);

  console.log('✅ Deployment completed successfully!');
  console.log(`📁 Files deployed to: ${FTP_PATH}`);
  console.log(`🌍 Environment: ${STAGE}`);

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}

function createWebConfig(buildDir) {
  const webConfigContent = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/API/" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>`;

  const webConfigPath = path.join(buildDir, 'web.config');
  fs.writeFileSync(webConfigPath, webConfigContent, 'utf8');
}

function copyDirectory(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Get list of files and directories
  const items = fs.readdirSync(src);

  items.forEach(item => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      // Recursively copy directory
      copyDirectory(srcPath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
      console.log(`📄 Copied: ${item}`);
    }
  });
}