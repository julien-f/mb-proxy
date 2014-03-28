# mb-proxy

> Basic Mapbox proxy server.

Tiles are cached by the server to avoid too many downloads from
Mapbox.

## Install

1. Download [manually](https://github.com/julien-f/mb-proxy/releases).

2. Copy the configuration file from the template.

```
cd mb-proxy/server
cp config.json.dist config.json
```

3. Edits the configuration.

4. Installs dependencies and compiles the client.

```
cd mb-proxy/client
npm install
./gulp --production
```

5. Installs dependencies and run the server.

```
cd mb-proxy/server
npm install
./bin/mb-proxy
```

6. Opens your browser.
