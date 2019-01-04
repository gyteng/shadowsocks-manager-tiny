const spawn = require('child_process').spawn;

let run = false;
let runParams = 'libev:aes-256-cfb';
let ssConfig = '127.0.0.1:6001';
const argv = process.argv.filter((ele, index) => index > 1);
argv.forEach((f, index) => {
  if(f === '--run' || f === '-r') {
    run = true;
    if(argv[index + 1] && !argv[index + 1].startsWith('-')) { runParams = argv[index + 1]; }
  }
  if(f === '--shadowsocks' || f === '-s') {
    ssConfig = argv[index + 1];
  }
});
if(!run) { return; }
let type = 'libev';
let method = 'aes-256-cfb';
if(runParams.indexOf(':') >= 0) {
  method = runParams.split(':')[1];
}
let shadowsocks;
if(runParams.indexOf('python') >= 0) {
  type = 'python';
  const tempPassword = 'qwerASDF' + Math.random().toString().substr(2, 8);
  shadowsocks = spawn('ssserver', ['-m', method, '-p', '65535', '-k', tempPassword, '--manager-address', ssConfig ]);
} else {
  shadowsocks = spawn('ss-manager', [ '-m', method, '-u', '--manager-address', ssConfig ]);
}

shadowsocks.stdout.on('data', (data) => {
  // console.log(`stdout: ${data}`);
});

shadowsocks.stderr.on('data', (data) => {
  // console.error(`stderr: ${data}`);
});

shadowsocks.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
console.log(`Run shadowsocks (${ type === 'python' ? 'python' : 'libev'})`);
