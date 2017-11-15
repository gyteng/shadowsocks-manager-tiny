# shadowsocks-manager-tiny

假设以前 s 端的配置文件为：

```
type: s
shadowsocks:
  address: 127.0.0.1:1234
manager:
  address: 0.0.0.0:5678
  password: 'abcxyz'
db: 'db.sqlite'
```

对应的启动方式：

```
node index.js 127.0.0.1:1234 0.0.0.0:5678 abcxyz
```