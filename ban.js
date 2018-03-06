const maxConnections = 10;
const banTime = 10;

const exec = require('child_process').exec;
const fs = require('fs');
const db = require('./db');
let account = {};

const getIpNumber = port => {
  const cmd = `netstat -ntu | grep ":${ port } " | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | grep -v 127.0.0.1 | wc -l`;
  return new Promise((resolve, reject) => {
    exec(cmd, function(err, stdout, stderr){
      if(err) {
        reject(stderr);
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

const checkConnectIpNumber = () => {
  db.listAccount().then(accounts => {
    accounts.forEach(account => {
      getIpNumber(account.port).then(success => {
        if(+success > maxConnections) {
          db.ban(+account.port);
        }
      });
    });
  });
  const banList = db.listBan();
  for(const port in banList) {
    if(Date.now() - banList[port] >= banTime * 60 * 1000) {
      db.unban(+port);
    }
  }
};

setInterval(() => {
  checkConnectIpNumber();
  console.log('ban list: ' + JSON.stringify(db.listBan()));
}, 60 * 1000);