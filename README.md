# shadowsocks-manager-tiny

## 基础用法

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

假如要同时运行 shadowsocks 的客户端：

```
node index.js 127.0.0.1:1234 0.0.0.0:5678 abcxyz libev:aes-256-cfb
node index.js 127.0.0.1:1234 0.0.0.0:5678 abcxyz python:aes-256-cfb
```

## 高级用法

若需要在开启每一个 ss 端口的同时，运行一个`kcptun`、`udp2raw`或者其他别的什么配套程序，首先把`cmd.sample.json`重命名为`cmd.json`，然后参考里面的内容填好运行参数即可。