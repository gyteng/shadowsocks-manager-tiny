const net = require('net');
const crypto = require('crypto');
const shadowsocks = require('./shadowsocks');
const db = require('./db');
let managerConfig = process.argv[3] || '0.0.0.0:6002';
let password = '123456';
const argv = process.argv.filter((ele, index) => index > 1);
argv.forEach((f, index) => {
  if(f === '--manager' || f === '-m') {
    managerConfig = argv[index + 1];
  }
  if(f === '--password' || f === '-p') {
    password = argv[index + 1];
  }
});
const host = managerConfig.split(':')[0];
const port = +managerConfig.split(':')[1];

const dateString = () => {
  const appendZero = (value, length) => {
    if(value.toString().length < length) {
      return new Array(length - value.toString().length + 1).join('0') + value.toString();
    }
    return value.toString();
  };
  const now = new Date();
  const year = now.getFullYear();
  const month = appendZero(now.getMonth() + 1, 2);
  const date = appendZero(now.getDate(), 2);
  const hour = appendZero(now.getHours(), 2);
  const minute = appendZero(now.getMinutes(), 2);
  const second = appendZero(now.getSeconds(), 2);
  const millisecond = appendZero(now.getMilliseconds(), 3);
  return `${ year }-${ month }-${ date } ${ hour }:${ minute }:${ second }.${ millisecond }`;
};

(function(o){
  if(o.__ts__){ return; }
  const slice = Array.prototype.slice;
  ['log', 'debug', 'info', 'warn', 'error'].forEach(f => {
    const _= o[f];
    o[f] = function() {
      const args = slice.call(arguments);
      args.unshift('[' + dateString() + ']');
      return _.apply(o, args);
    };
  });
  o.__ts__ = true;
})(console);

const receiveCommand = (data, code) => {
  const time = Number.parseInt(data.slice(0, 6).toString('hex'), 16);
  if(!db.addCommand(data, code)) {
    return Promise.reject();
  }
  const message = JSON.parse(data.slice(6).toString());
  // console.log(message);
  if(message.command === 'add') {
    const port = +message.port;
    const password = message.password;
    return shadowsocks.addAccount(port, password);
  } else if (message.command === 'del') {
    const port = +message.port;
    return shadowsocks.removeAccount(port);
  } else if (message.command === 'list') {
    return shadowsocks.listAccount();
  } else if (message.command === 'pwd') {
    const port = +message.port;
    const password = message.password;
    return shadowsocks.changePassword(port, password);
  } else if (message.command === 'flow') {
    const options = message.options;
    return shadowsocks.getFlow(options);
  } else if (message.command === 'version') {
    return shadowsocks.getVersion();
  } else if (message.command === 'ip') {
    return shadowsocks.getClientIp(message.port);
  } else {
    return Promise.reject();
  }
};

const pack = (data) => {
  const message = JSON.stringify(data);
  const dataBuffer = Buffer.from(message);
  const length = dataBuffer.length;
  const lengthBuffer = Buffer.from(('0000000000000000' + length.toString(16)).substr(-8), 'hex');
  const pack = Buffer.concat([lengthBuffer, dataBuffer]);
  return pack;
};

const checkCode = (data, password, code) => {
  const time = Number.parseInt(data.slice(0, 6).toString('hex'), 16);
  // console.log(data.slice(0, 6).toString('hex'));
  if(Math.abs(Date.now() - time) > 10 * 60 * 1000) {
    return false;
  }
  const command = data.slice(6).toString();
  const md5 = crypto.createHash('md5').update(time + command + password).digest('hex');
  return md5.substr(0, 8) === code.toString('hex');
};

const printBuffer = buffer => {
  const showBuffer = bufferArray => {
    return bufferArray.map(m => {
      const number = Number.parseInt(m, 16);
      if(number >= 32 && number <= 126) {
        return Buffer.from(m, 'hex').toString();
      } else {
        return ' ';
      }
    }).join('');
  };
  const hexString = buffer.toString('hex');
  const hexStringArray = hexString.toString('hex')
  .split('')
  .map((ele, index, arr) => { return (index % 2) === 0 ? ele + arr[index + 1] : null })
  .filter(f => f);
  let log = '';
  log += hexStringArray.join(' ') + '\n-----------------------------\n';
  log += '00 01 02 03 04 05 06 07 08 09\n\n';
  const hexStringLine = hexStringArray.map((ele, index, arr) => {
    if(index % 10 === 0) {
      return arr.slice(index, index + 10);
    }
  }).filter(f => f);
  log += hexStringLine.map(ele => {
    const appendSpace = new Array(10 - ele.length + 1).join('   ');
    return ele.join(' ') + appendSpace  + '   ' + showBuffer(ele);
  }).join('\n');
  log += '\n-----------------------------\n';
  log += 'length:  ' + Number.parseInt(buffer.slice(0, 2).toString('hex'), 16) + '\n';
  log += 'version: ' + buffer.slice(2, 3).toString('hex');
  log += '\n-----------------------------';
  console.log(log);
};

const checkData = (receive) => {
  const buffer = receive.data;
  let length = 0;
  let data;
  let code;
  if (buffer.length < 2) {
    return;
  }
  length = buffer[0] * 256 + buffer[1];
  if (buffer.length >= length + 2) {
    printBuffer(buffer);
    data = buffer.slice(2, length - 2);
    code = buffer.slice(length - 2);
    if(!checkCode(data, password, code)) {
      receive.socket.end();
      return;
    }
    receiveCommand(data, code).then(s => {
      receive.socket.end(pack({code: 0, data: s}));
    }, e => {
      console.error(e);
      receive.socket.end(pack({code: 1}));
    });
    if(buffer.length > length + 2) {
      checkData(receive);
    }
  }
};

const receiveData = (receive, data) => {
  receive.data = Buffer.concat([receive.data, data]);
  checkData(receive);
};

const server = net.createServer(socket => {
  const receive = {
    data: Buffer.from(''),
    socket: socket,
  };
  socket.on('data', data => {
    receiveData(receive, data);
  });
  socket.on('end', () => {});
  socket.on('close', () => {});
}).on('error', (err) => {
  console.error(`socket error: `, err);
});

server.listen({
  port,
  host,
}, () => {
  console.log(`server listen on ${ host }:${ port }`);
});
