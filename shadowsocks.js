const dgram = require('dgram');
const exec = require('child_process').exec;
const client = dgram.createSocket('udp4');
const version = require('./package.json').version;
const db = require('./db');
const rop = require('./runOtherProgram');
const http = require('http');

let clientIp = [];

let ssConfig = '127.0.0.1:6001';
let managerConfig = '0.0.0.0:6002';
const argv = process.argv.filter((ele, index) => index > 1);
argv.forEach((f, index) => {
  if(f === '--manager' || f === '-m') {
    managerConfig = argv[index + 1];
  }
  if(f === '--shadowsocks' || f === '-s') {
    ssConfig = argv[index + 1];
  }
});
const mPort = +managerConfig.split(':')[1];
const host = ssConfig.split(':')[0];
const port = +ssConfig.split(':')[1];

client.bind(mPort);

let shadowsocksType = 'libev';
let isNewPython = false;
let lastFlow;

const sendPing = () => {
  client.send(Buffer.from('ping'), port, host);
  client.send(Buffer.from('list'), port, host);
};

const addMessageCache = [];

const sendAddMessage = (messagePort, messagePassword) => {
  addMessageCache.push({ port: messagePort, password: messagePassword});
  return Promise.resolve('ok');
};

setInterval(async () => {
  let number = 10;
  if(addMessageCache.length >= 600) {
    number = Math.ceil(addMessageCache.length / 60);
  }
  for(let i = 0; i < number; i++) {
    if(!addMessageCache.length && !libevListed) { continue; }
    const message = addMessageCache.shift();
    if(!message) { continue; }
    const exists = !!portsForLibevObj[message.port];
    if(exists) { continue; }
    console.log(`增加ss端口: ${ message.port } ${ message.password }`);
    client.send(`add: {"server_port": ${ message.port }, "password": "${ message.password }"}`, port, host);
    rop.run(message.port, message.password);
  }
}, 1000);

const sendDelMessage = (messagePort) => {
  console.log(`删除ss端口: ${ messagePort }`);
  client.send(`remove: {"server_port": ${ messagePort } }`, port, host);
  rop.kill(messagePort);
  return Promise.resolve('ok');
};

let existPort = [];
let existPortUpdatedAt = Date.now();
const setExistPort = flow => {
  existPort = [];
  if(Array.isArray(flow)) {
    existPort = flow.map(f => +f.server_port);
  } else {
    for(const f in flow) {
      existPort.push(+f);
    }
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
let libevListed = false;
let portsForLibev = [];
let portsForLibevObj = {};
const connect = () => {
  client.on('message', async msg => {
    const msgStr = new String(msg);
    if(msgStr.substr(0, 4) === 'pong') {
      shadowsocksType = 'python';
    } else if(msgStr.substr(0, 2) === '[{') {
      isNewPython = true;
      portsForLibev = JSON.parse(msgStr);
      portsForLibevObj = {};
      portsForLibev.forEach(f => {
        portsForLibevObj[f.server_port] = f.password;
      });
      if(!libevListed) {
        resend();
        libevListed = true;
      }
    } else if(msgStr.substr(0, 3) === '[\n\t') {
      portsForLibev = JSON.parse(msgStr);
      portsForLibevObj = {};
      portsForLibev.forEach(f => {
        portsForLibevObj[f.server_port] = f.password;
      });
      if(!libevListed) {
        resend();
        libevListed = true;
      }
    } else if(msgStr.substr(0, 5) === 'stat:') {
      let flow = JSON.parse(msgStr.substr(5));
      setExistPort(flow);
      const realFlow = compareWithLastFlow(flow, lastFlow);

      const getConnectedIp = port => {
        setTimeout(() => {
          getIp(+port).then(ips => {
            ips.forEach(ip => {
              clientIp.push({ port: +port, time: Date.now(), ip });
            });
          });
        }, Math.ceil(Math.random() * 3 * 60 * 1000));
      };
      if((new Date()).getMinutes() % 3 === 0) {
        for(const rf in realFlow) {
          if(realFlow[rf]) {
            getConnectedIp(rf);
          }
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

      const accounts = await db.listAccount();
      if(shadowsocksType === 'python' && !isNewPython) {
        insertFlow.forEach(fe => {
          const account = accounts.filter(f => {
            return fe.port === f.port;
          })[0];
          if(!account) {
            sendDelMessage(fe.port);
          }
        });
      } else {
        portsForLibev.forEach(async f => {
          const account = accounts.filter(a => a.port === +f.server_port)[0];
          if(!account) {
            sendDelMessage(+f.server_port);
          } else if (account.password !== f.password) {
            sendDelMessage(f.server_port);
            sendAddMessage(f.server_port, account);
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
    };
  });

  client.on('error', err => {
    console.error(`client error: `, err);
  });
  client.on('close', () => {
    console.error(`client close`);
  });
};

const startUp = async () => {
  client.send(Buffer.from('ping'), port, host);
  const accounts = await db.listAccount();
  for(const account of accounts) {
    sendAddMessage(account.port, account.password);
  }
};

const resend = async () => {
  if(Date.now() - existPortUpdatedAt >= 180 * 1000) {
    existPort = [];
  }
  const accounts = await db.listAccount();
  for(const account of accounts) {
    if(!existPort.includes(account.port)) {
      sendAddMessage(account.port, account.password);
    }
  }
};

let isGfw = 0;
let getGfwStatusTime = null;
const getGfwStatus = () => {
  if(getGfwStatusTime && isGfw === 0 && Date.now() - getGfwStatusTime < 600 * 1000) { return; }
  getGfwStatusTime = Date.now();
  const sites = [
    'baidu.com:80',
  ];
  const site = sites[0];
  // const site = sites[+Math.random().toString().substr(2) % sites.length];
  const req = http.request({
    hostname: site.split(':')[0],
    port: +site.split(':')[1],
    path: '/',
    method: 'GET',
    timeout: 2000,
  }, res => {
    if(res.statusCode === 200) {
      isGfw = 0;
    }
    res.setEncoding('utf8');
    res.on('data', (chunk) => {});
    res.on('end', () => {});
  });
  req.on('timeout', () => {
    req.abort();
    isGfw += 1;
  });
  req.on('error', (e) => {
    isGfw += 1;
  });
  req.end();
};

connect();
startUp();
setInterval(() => {
  sendPing();
  resend();
  getGfwStatus();
}, 60 * 1000);

const addAccount = (port, password) => {
  return db.addAccount(port, password).then(success => {
    sendAddMessage(port, password);
  }).then(() => {
    return { port, password };
  });
};

const removeAccount = port => {
  return db.removeAccount(port).then(() => {
    return sendDelMessage(port);
  }).then(() => {
    return { port };
  });
};

const changePassword = (port, password) => {
  return db.updateAccount(port, password).then(() => {
    return sendDelMessage(port);
  }).then(() => {
    return sendAddMessage(port, password);
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
  return Promise.resolve({
    version: version + 'T',
    isGfw: !!(isGfw > 5),
  });
};

const getIp = port => {
  const cmd = `ss -an | grep ":${ port } " | grep ESTAB | awk '{print $6}' | cut -d: -f1 | grep -v 127.0.0.1 | uniq -d`;
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