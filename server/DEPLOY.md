# 中继服务器部署指南

## 方案一：fly.io 免费部署（推荐，最傻瓜）

[fly.io](https://fly.io) 提供免费额度，自动配置 TLS 证书（HTTPS/WSS），香港有节点。

### 1. 注册并安装 CLI

```bash
# macOS
brew install flyctl

# 注册账号
fly auth signup
```

### 2. 部署（一行命令）

```bash
cd server
fly launch
# 按提示选择：地区选 hkg (Hong Kong)，其他默认即可
```

部署完成后会得到一个域名，例如 `https://interpreter-relay.fly.dev`。

### 3. 配置到应用中

打开应用的 **设置 → 中继服务器地址**，填入：
```
https://interpreter-relay.fly.dev
```

完成！所有安装了应用的 Windows 用户都能通过这个中继服务器连接。

---

## 方案二：阿里云 / 腾讯云 香港轻量服务器

适合已有国内云账号的用户。香港轻量服务器最低配 ~24元/月。

### 1. 购买服务器

- 阿里云：轻量应用服务器，地域选**香港**，最低配 24元/月
- 系统选 Ubuntu 22.04

### 2. 安装 Docker

```bash
curl -fsSL https://get.docker.com | bash
```

### 3. 部署

```bash
# 上传 server 目录到服务器
scp -r server/ root@你的服务器IP:/opt/relay/

# SSH 到服务器
ssh root@你的服务器IP

cd /opt/relay
docker compose up -d
```

### 4. 配置 Nginx 反向代理 + SSL

```bash
apt install -y nginx certbot python3-certbot-nginx

# 先把域名解析到服务器 IP，然后：
certbot --nginx -d relay.你的域名.com
```

Nginx 配置参考 `nginx.conf` 文件。

### 5. 在应用中设置

设置 → 中继服务器地址 → `https://relay.你的域名.com`

---

## 方案三：Docker 一键部署（已有服务器）

```bash
cd server
docker compose up -d
```

然后用 Nginx/Caddy 反代并加 TLS。

---

## 中继服务器工作原理

```
[中国用户] ──WSS──▶ [中继服务器 (香港)] ◀──WSS── [国外用户]
                         │
                   6位房间号匹配
```

- 两台设备通过同一个 **6 位房间号** 配对
- 所有数据（翻译音频、文本）通过服务器中转
- WebSocket over TLS（WSS）看起来就是普通 HTTPS 流量，不会被墙
- 服务器**不存储**任何对话内容
- 香港节点对中国和国外延迟都低（~30-50ms）

---

## 性能参考

| 服务器配置 | 并发房间数 | 月流量估计 |
|-----------|-----------|-----------|
| 1 vCPU / 512MB | ~50 | ~10GB |
| 1 vCPU / 1GB | ~200 | ~50GB |
| 2 vCPU / 2GB | ~500+ | ~200GB |

一个房间 = 两台设备互相发送翻译音频，约 10-50KB/s。
