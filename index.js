process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

process.on('uncaughtException', err => {
  console.error(`Caught exception: ${err}`);
});

require('./shadowsocks');
require('./server');
require('./run');