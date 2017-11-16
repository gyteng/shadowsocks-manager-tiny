const spawn = require('child_process').spawn;
if(!process.argv[5]) {
  return;
}
let runParams = process.argv[5];
let type = 'libev';
let method = 'aes-256-cfb';
if(runParams.indexOf(':') >= 0) {
  method = runParams.split(':')[1];
}
let shadowsocks;
if(runParams.indexOf('python') >= 0) {
  type = 'python';
  const tempPassword = 'qwerASDF' + Math.random().toString().substr(2, 8);
  shadowsocks = spawn('ssserver', ['-m', method, '-p', '65535', '-k', tempPassword, '--manager-address', process.argv[2] ]);
} else {
  shadowsocks = spawn('ss-manager', [ '-m', method, '-u', '--manager-address', process.argv[2] ]);
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
