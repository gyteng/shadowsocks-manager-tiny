const net = require('net');
const crypto = require('crypto');
const shadowsocks = require('./shadowsocks');

const managerConfig = process.argv[3] || '0.0.0.0:6002';
const host = managerConfig.split(':')[0];
const port = +managerConfig.split(':')[1];
const password = process.argv[4] || '123456';

const receiveCommand = (data, code) => {
  const time = Number.parseInt(data.slice(0, 6).toString('hex'), 16);
  // await knex('command').whereBetween('time', [0, Date.now() - 10 * 60 * 1000]).del();
  // await knex('command').insert({
  //   code: code.toString('hex'),
  //   time,
  // });
  const message = JSON.parse(data.slice(6).toString());
  console.log(message);
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
  const lengthBuffer = Buffer.from(('0000' + length.toString(16)).substr(-4), 'hex');
  const pack = Buffer.concat([lengthBuffer, dataBuffer]);
  return pack;
};

const checkCode = (data, password, code) => {
  const time = Number.parseInt(data.slice(0, 6).toString('hex'), 16);
  if(Math.abs(Date.now() - time) > 10 * 60 * 1000) {
    return false;
  }
  const command = data.slice(6).toString();
  const md5 = crypto.createHash('md5').update(time + command + password).digest('hex');
  return md5.substr(0, 8) === code.toString('hex');
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