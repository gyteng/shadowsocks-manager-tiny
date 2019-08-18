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
// 检测端口是否已占用，占用则端口号-1
const net=require('net')
function portIsOccupied (port){
    const server=net.createServer().listen(port)
    return new Promise((resolve,reject)=>{
        server.on('listening',()=>{
            server.close()
            resolve(port)
        })
        server.on('error',(err)=>{
            if(err.code==='EADDRINUSE'){
                resolve(portIsOccupied(port-1)) // 注意这句，如占用端口号-1
            }else{
                reject(err)
            }
        })
    })
}
// 默认端口65535
portIsOccupied(65535)
.then(port=>{
    // console.log(port);
    if(runParams.indexOf('python') >= 0) {
    type = 'python';
    const tempPassword = 'qwerASDF' + Math.random().toString().substr(2, 8);
        shadowsocks = spawn('ssserver', ['-m', method, '-p', port, '-k', tempPassword, '--manager-address', ssConfig ]);
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
})
