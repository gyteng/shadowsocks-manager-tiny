const dgram = require('dgram');
const exec = require('child_process').exec;
const client = dgram.createSocket('udp4');
const version = require('./package.json').version;
const db = require('./db');

let clientIp = [];

const ssConfig = process.argv[2] || '127.0.0.1:6001';
const host = ssConfig.split(':')[0];
const port = +ssConfig.split(':')[1];

let shadowsocksType = '';
let lastFlow;

const sendPing = () => {
  client.send(Buffer.from('ping'), port, host);
  if(shadowsocksType === 'libev') {
    client.send(Buffer.from('list'), port, host);
  }
};

let existPort = [];
let existPortUpdatedAt = Date.now();
const setExistPort = flow => {
  existPort = [];
  for(const f in flow) {
    existPort.push(+f);
  }
  existPortUpdatedAt = Date.now();
};

const compareWithLastFlow = (flow, lastFlow) => {
  if(shadowsocksType === 'python') {
    return flow;
  }
  const realFlow = {};
  if(!lastFlow) {
    for(const f in flow) {
      if(flow[f] <= 0) { delete flow[f]; }
    }
    return flow;
  }
  for(const f in flow) {
    if(lastFlow[f]) {
      realFlow[f] = flow[f] - lastFlow[f];
    } else {
      realFlow[f] = flow[f];
    }
  }
  if(Object.keys(realFlow).map(m => realFlow[m]).sort((a, b) => a > b)[0] < 0) {
    return flow;
  }
  for(const r in realFlow) {
    if(realFlow[r] <= 0) { delete realFlow[r]; }
  }
  return realFlow;
};

let firstFlow = true;
let portsForLibev = [];
const connect = () => {
  client.on('message', (msg, rinfo) => {
    const msgStr = new String(msg);
    // console.log(msgStr);
    if(msgStr.substr(0, 4) === 'pong') {
      shadowsocksType = 'python';
    } else if(msgStr.substr(0, 3) === '[\n\t') {
      portsForLibev = JSON.parse(msgStr);
    } else if(msgStr.substr(0, 5) === 'stat:') {
      let flow = JSON.parse(msgStr.substr(5));
      setExistPort(flow);
      const realFlow = compareWithLastFlow(flow, lastFlow);

      for(const rf in realFlow) {
        if(realFlow[rf]) {
          (function(port) {
            getIp(+port).then(ips => {
              ips.forEach(ip => {
                clientIp.push({ port: +port, time: Date.now(), ip });
              });
            });
          })(rf);
        }
      }

      lastFlow = flow;
      const insertFlow = Object.keys(realFlow).map(m => {
        return {
          port: +m,
          flow: +realFlow[m],
          time: Date.now(),
        };
      }).filter(f => {
        return f.flow > 0;
      });
      db.listAccount().then(accounts => {
        if(shadowsocksType === 'python') {
          // python
          insertFlow.forEach(fe => {
            const account = accounts.filter(f => {
              return fe.port === f.port;
            })[0];
            if(!account) {
              sendMessage(`remove: {"server_port": ${ fe.port }}`);
            }
          });
        } else if(shadowsocksType === '') {
          shadowsocksType === 'libev';
        } else if(shadowsocksType === 'libev') {
          // libev
          portsForLibev.forEach(f => {
            const account = accounts.filter(a => a.port === +f.server_port)[0];
            if(!account) {
              sendMessage(`remove: {"server_port": ${ f.server_port }}`);
            } else if (account.password !== f.password) {
              sendMessage(`remove: {"server_port": ${ f.server_port }}`);
              sendMessage(`add: {"server_port": ${ account.port }, "password": "${ account.password }"}`);
            }
          });
        }
        if(insertFlow.length > 0) {
          if(firstFlow) {
            firstFlow = false;
          } else {
            const insertPromises = [];
            for(let i = 0; i < Math.ceil(insertFlow.length/50); i++) {
              const insert = db.insertFlow(insertFlow.slice(i * 50, i * 50 + 50));
              insertPromises.push(insert);
            }
            Promise.all(insertPromises).then();
          }
        }
      });
    };
  });

  client.on('error', err => {
    console.error(`client error: `, err);
  });
  client.on('close', () => {
    console.error(`client close`);
  });
};

const sendMessage = (message) => {
  client.send(message, port, host);
  return Promise.resolve('ok');
};

const startUp = () => {
  client.send(Buffer.from('ping'), port, host);
  db.listAccount().then(accounts => {
    accounts.forEach(f => {
      sendMessage(`add: {"server_port": ${ f.port }, "password": "${ f.password }"}`);
    });
  });
};

const resend = () => {
  if(shadowsocksType === 'python') {
    if(Date.now() - existPortUpdatedAt >= 180 * 1000) {
      existPort = [];
    }
    db.listAccount().then(accounts => {
      accounts.forEach(f => {
        if(existPort.indexOf(f.port) < 0) {
          sendMessage(`add: {"server_port": ${ f.port }, "password": "${ f.password }"}`);
        }
      });
    });
  } else if (shadowsocksType === 'libev') {
    db.listAccount().then(accounts => {
      accounts.forEach(account => {
        const exists = portsForLibev.filter(p => +p.server_port === account.port)[0];
        if(!exists) {
          sendMessage(`add: {"server_port": ${ account.port }, "password": "${ account.password }"}`);
        }
      });
    });
  }
};

connect();
startUp();
setInterval(() => {
  sendPing();
  resend();
}, 60 * 1000);

const addAccount = (port, password) => {
  return db.addAccount(port, password).then(() => {
    return sendMessage(`add: {"server_port": ${ port }, "password": "${ password }"}`);
  }).then(() => {
    return { port, password };
  });
};

const removeAccount = port => {
  return db.removeAccount(port).then(() => {
    return sendMessage(`remove: {"server_port": ${ port }}`);
  }).then(() => {
    return { port };
  });
};

const changePassword = (port, password) => {
  return db.updateAccount(port, password).then(() => {
    return sendMessage(`remove: {"server_port": ${ port }}`);
  }).then(() => {
    return sendMessage(`add: {"server_port": ${ port }, "password": "${ password }"}`);
  }).then(() => {
    return { port };
  });
};

const listAccount = () => {
  return Promise.resolve(db.listAccount());
};

const getFlow = (options) => {
  const startTime = options.startTime || 0;
  const endTime = options.endTime || Date.now();
  return db.getFlow(options);
};

const getVersion = () => {
  return Promise.resolve({ version });
};

const getIp = port => {
  const cmd = `netstat -ntu | grep ":${ port } " | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | grep -v 127.0.0.1 | uniq -d`;
  return new Promise((resolve, reject) => {
    exec(cmd, function(err, stdout, stderr){
      if(err) {
        reject(stderr);
      } else {
        const result = [];
        stdout.split('\n').filter(f => f).forEach(f => {
          if(result.indexOf(f) < 0) { result.push(f); }
        });
        resolve(result);
      }
    });
  });
};

const getClientIp = port => {
  clientIp = clientIp.filter(f => {
    return Date.now() - f.time <= 15 * 60 * 1000;
  });
  const result = [];
  clientIp.filter(f => {
    return Date.now() - f.time <= 15 * 60 * 1000 && f.port === port;
  }).map(m => {
    return m.ip;
  }).forEach(f => {
    if(result.indexOf(f) < 0) { result.push(f); }
  });
  return Promise.resolve(result);
};

exports.addAccount = addAccount;
exports.removeAccount = removeAccount;
exports.changePassword = changePassword;
exports.listAccount = listAccount;
exports.getFlow = getFlow;
exports.getVersion = getVersion;
exports.getClientIp = getClientIp;