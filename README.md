# shadowsocks-manager-tiny

## 基础用法

```
node index.js -s 127.0.0.1:1234 \
              -m 0.0.0.0:5678 \
              -p abcxyz \
              -r libev:aes-256-cfb \
              -d ./data.json
```

## 高级用法

若需要在开启每一个 ss 端口的同时，运行一个`kcptun`、`udp2raw`或者其他别的什么配套程序，首先把`cmd.sample.json`重命名为`cmd.json`，然后参考里面的内容填好运行参数即可。

所有端口都运行的配置文件示例：

```
[
  "/your/kcprun/server/file/path/server_linux_amd64 -t 127.0.0.1:${port} -l :${port+10000} --key ${password}"
]
```

仅部分端口运行的配置文件示例：

```
[
  {
    "port": "10000,11000,12000-12100,13000-14000",
    "cmd": "/your/kcprun/server/file/path/server_linux_amd64 -t 127.0.0.1:${port} -l :${port+10000} --key ${password}"
  }
]
```
