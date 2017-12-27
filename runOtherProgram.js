const spawn = require('child_process').spawn;
const process = {};

let commands = [];

try {
  commands = require('./cmd.json');
} catch (err) {
}

const getPorts = portString => {
  const portArray = [];
  portString.split(',').forEach(f => {
    if (f.indexOf('-') < 0) {
      portArray.push(+f);
    } else {
      const start = f.split('-')[0];
      const end = f.split('-')[1];
      for (let p = +start; p <= +end; p++) {
        portArray.push(p);
      }
    }
  });
  return portArray;
};

const run = (port, password) => {
  if(commands.length === 0) { return; }
  if(process[port]) { return; }
  process[port] = [];
  commands.forEach(commandObj => {
    let command = commandObj;
    if(typeof commandObj === 'object') {
      command = commandObj.cmd;
      const ports = getPorts(commandObj.port);
      if(ports.indexOf(port) < 0) {
        return;
      }
    }
    const cmdName = command.split(' ')[0];
    let cmdParameters = command
      .replace(/\${port}/g, port.toString())
      .replace(/\${password}/g, password.toString())
      .replace(/\${port\+\d{1,5}}/g, function(match) {
        const number = +match.substring(7, match.length - 1);
        return port + number;
      })
      .replace(/\${port\-\d{1,5}}/g, function(match) {
        const number = +match.substring(7, match.length - 1);
        return port - number;
      })
      .split(' ');
    cmdParameters.splice(0, 1);
    console.log(`运行外部进程: ${ cmdName } ${ cmdParameters.join(' ') }`);
    const cmd = spawn(cmdName, cmdParameters);
    cmd.stdout.on('data', (data) => {
      // console.log(data.toString());
    });
    cmd.stderr.on('data', (data) => {
      // console.log(data.toString());
    });
    cmd.on('close', (code) => {});
    process[port].push(cmd);
  });
};

const kill = (port) => {
  if(commands.length === 0) { return; }
  if(!process[port]) { return; }
  process[port].forEach(f => {
    f.stdin.pause();
    f.kill();
    console.log(`杀死外部进程: ${ port }`);
  });
  delete process[port];
};

exports.run = run;
exports.kill = kill;