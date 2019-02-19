const fs = require('fs');

let dataFilePath = './data.json';
const argv = process.argv.filter((ele, index) => index > 1);
argv.forEach((f, index) => {
  if(f === '--db' || f === '-d') {
    dataFilePath = argv[index + 1];
  }
});

let data = {
  account: {},
  flow: [],
  command: {},
};

const readLocalFile = () => {
  try {
    fs.statSync(dataFilePath);
    data.account = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
  } catch(err) {
    fs.openSync(dataFilePath, 'w');
  }
};

readLocalFile();

const writeFile = () => {
  fs.writeFileSync(dataFilePath, JSON.stringify(data.account));
};

const addAccount = (port, password) => {
  if(!data.account[port]) {
    data.account[port] = password;
  }
  return Promise.resolve();
};

const removeAccount = port => {
  delete data.account[port];
  return Promise.resolve();
};

const updateAccount = (port, password) => {
  data.account[port] = password;
  return Promise.resolve();
};

const listAccount = () => {
  return Promise.resolve(Object.keys(data.account).map(k => {
    return {
      port: +k,
      password: data.account[k],
    };
  }));
};

const listAccountObj = () => {
  return Promise.resolve(data.account);
};

const insertFlow = flow => {
  flow.forEach(f => {
    data.flow.push({
      time: Date.now(),
      port: f.port,
      flow: +f.flow,
    });
  });
  return Promise.resolve();
};

const getFlow = options => {
  writeFile();
  const startTime = options.startTime || 0;
  const endTime = options.endTime || Date.now();
  const accounts = {};
  data.flow.forEach(f => {
    if(f.time >= startTime && f.time <= endTime) {
      if(!accounts.hasOwnProperty(f.port)) {
        accounts[f.port] = 0;
      }
      accounts[f.port] += f.flow;
    }
  });
  if(options.clear) {
    data.flow = data.flow.filter(f => {
      return !!(f.time < startTime || f.time > endTime);
    });
  }
  return Promise.resolve(Object.keys(accounts).map(k => {
    return {
      port: +k,
      sumFlow: accounts[k],
    };
  }));
};

const addCommand = (commandData, code) => {
  const time = Number.parseInt(commandData.slice(0, 6).toString('hex'), 16);
  if(data.command[code.toString('hex')]) {
    return false;
  }
  data.command[code.toString('hex')] = time;
  for(const c in data.command) {
    if(data.command[c] <= Date.now() - 10 * 60 * 1000) {
      delete data.command[c];
    }
  }
  return true;
};

exports.addAccount = addAccount;
exports.removeAccount = removeAccount;
exports.updateAccount = updateAccount;
exports.listAccount = listAccount;
exports.listAccountObj = listAccountObj;
exports.insertFlow = insertFlow;
exports.getFlow = getFlow;
exports.addCommand = addCommand;