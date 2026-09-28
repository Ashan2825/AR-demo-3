/**
 * Builds the web AR page and copies it into the Android app's assets so the
 * packaged APK can load it from file:///android_asset/web/index.html offline.
 *
 * Expo's export writes absolute asset URLs ("/_expo/..."), which resolve to the
 * filesystem root under file://, so they are rewritten to relative paths here.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const androidAssets = path.join(root, 'android', 'app', 'src', 'main', 'assets');
const target = path.join(androidAssets, 'web');

if (!fs.existsSync(path.join(root, 'android'))) {
  console.error('No android/ directory. Run "npx expo prebuild -p android" first.');
  process.exit(1);
}

console.log('> exporting web build');
execSync('npx expo export -p web --clear', { stdio: 'inherit' });

const indexPath = path.join(dist, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8').replace(/(src|href)="\/(?!\/)/g, '$1="./');
fs.writeFileSync(indexPath, html);

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(dist, target, { recursive: true });

const files = fs.readdirSync(target);
console.log(`> copied ${files.length} entries into android/app/src/main/assets/web`);
