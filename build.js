#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');
const readline = require('readline');

const REQUIRED_JAVA_MAJOR = 21;
const SERVER_JAR = process.env.SERVER_JAR || 'server.jar';
const NOTCHIAN_DIR = 'notchian';

// ASCII Art for the project
const ASCII_ART = `
               _             
     /\\       | |            
    /  \\   ___| |_ _ __ __ _ 
   / /\\ \\ / __| __| '__/ _\` |
  / ____ \\\\__ \\ |_| | | (_| |
 /_/    \\_\\___/\\__|_|  \\__,_|
                             
                             
`;

// Get project version from package.json or default
async function getVersion() {
  try {
    const packageJson = await fs.readFile('package.json', 'utf8');
    const pkg = JSON.parse(packageJson);
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

// Prompt user for confirmation
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

// Check if file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Get Java version
function getJavaVersion() {
  return new Promise((resolve, reject) => {
    const java = spawn('java', ['-version'], { stdio: 'pipe' });
    let output = '';
    java.stderr.on('data', (data) => {
      output += data.toString();
    });
    java.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('Java not found'));
        return;
      }
      const match = output.match(/version "(\d+)\./) || output.match(/openjdk version "(\d+)\./);
      if (match) {
        resolve(parseInt(match[1]));
      } else {
        reject(new Error('Could not parse Java version'));
      }
    });
  });
}

// Run command and return promise
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

// Main build function
async function main() {
  console.log(ASCII_ART);
  const version = await getVersion();
  console.log(`Version: ${version}\n`);

  // Check for registries.h
  if (!(await fileExists('include/registries.h'))) {
    console.log('Error: include/registries.h is missing.');
    console.log('Please run the registry extraction step first.');
    process.exit(1);
  }

  // Check Java
  console.log('Checking Java installation...');
  try {
    const javaVersion = await getJavaVersion();
    if (javaVersion < REQUIRED_JAVA_MAJOR) {
      console.log(`Error: Java ${REQUIRED_JAVA_MAJOR} or newer required, but found Java ${javaVersion}.`);
      process.exit(1);
    }
    console.log(`Java ${javaVersion} found.`);
  } catch (error) {
    console.log('Error: Java not found in PATH.');
    process.exit(1);
  }

  // Prepare notchian directory
  if (!(await fileExists(NOTCHIAN_DIR))) {
    console.log(`Creating ${NOTCHIAN_DIR} directory...`);
    await fs.mkdir(NOTCHIAN_DIR);
  }

  // Change to notchian directory
  process.chdir(NOTCHIAN_DIR);

  // Check for server.jar
  if (!(await fileExists(SERVER_JAR))) {
    console.log(`No ${SERVER_JAR} found.`);
    console.log('Please download the server.jar from https://www.minecraft.net/en-us/download/server');
    console.log('and place it in the notchian directory.');
    process.exit(1);
  }

  // Run registry dump
  console.log('Dumping registries...');
  await runCommand('java', ['-DbundlerMainClass=net.minecraft.data.Main', '-jar', SERVER_JAR, '--all']);

  // Change back to root
  process.chdir('..');

  // Run build_registries.js
  console.log('Processing registries...');
  const { convert } = require('./build_registries.js');
  await convert();

  // Compilation
  console.log('Compiling C source files...');

  const isWindows = os.platform() === 'win32';
  const exe = isWindows ? '.exe' : '';
  const compiler = 'gcc';

  let windowsLinker = '';
  if (isWindows) {
    windowsLinker = '-lws2_32 -pthread -lm';
  }

  // Handle --9x argument
  const args = process.argv.slice(2);
  if (args.includes('--9x')) {
    if (isWindows) {
      // Assuming MinGW64, adjust compiler
      // For simplicity, we'll assume gcc is set, but in real MinGW64 it might be different
      windowsLinker += ' -Wl,--subsystem,console:4';
    } else {
      console.log('Error: Compiling for Windows 9x is only supported on Windows.');
      process.exit(1);
    }
  }

  // Get source files
  const srcDir = 'src';
  const srcFiles = (await fs.readdir(srcDir))
    .filter(file => file.endsWith('.c'))
    .map(file => path.join(srcDir, file));

  const exePath = `astra${exe}`;
  const includeDir = '-Iinclude';
  const optimization = '-O3';
  const compileArgs = [...srcFiles, optimization, includeDir, '-o', exePath, ...windowsLinker.split(' ').filter(Boolean)];

  await runCommand(compiler, compileArgs);

  // Run the executable
  console.log(`Running ${exePath}...`);
  await runCommand(`./${exePath}`, [], { cwd: process.cwd() });

  console.log('Build complete!');
}

main().catch(console.error);
