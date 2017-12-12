const spawn = require('child_process').spawn;
const process = {};

let commands = [];

try {
  commands = require('./cmd.json');
} catch (err) {
}

const run = (port, password) => {
  if(commands.length === 0) { return; }
  if(process[port]) { return; }
  process[port] = [];
  commands.forEach(command => {
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
    // console.log(cmdName, cmdParameters);
    const cmd = spawn(cmdName, cmdParameters);
    cmd.stdout.on('data', (data) => {
      // console.log(data.toString());
    });
    cmd.stderr.on('data', (data) => {
      console.log(data.toString());
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
  });
  delete process[port];
};

exports.run = run;
exports.kill = kill;