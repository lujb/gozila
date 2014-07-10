var fs = require('fs');
var url = require('url');
var path = require('path');
var http = require('http');
var prompt = require('prompt');
var request = require('request');
var httpProxy = require('http-proxy');
var portfinder = require('portfinder');

var home = process.env.HOME;
var confpath = path.join(home, '.godzilla', 'gozila.json');
var npmrc = path.join(home, '.npmrc');

var VERSION = 201407091825;
var oldrc = fs.readFileSync(npmrc, 'utf8');


// trap `CTRL-C`
require('shutdown-handler').on('exit', function() {
    fs.writeFileSync(npmrc, oldrc, 'utf8');
});

// load local config
try {
    var config = JSON.parse(fs.readFileSync(confpath, 'utf8'));
} catch(err) {
    console.log(err);
    return;
}

// read credentials
readCredentials(fire);

// fire in the hole
function fire(err, credentials) {
    if (err) {
        console.log(err);
        return;
    }

    var s = credentials.username + ':' + credentials.password;
    config.user = credentials.username;
    config.auth = new Buffer(s).toString('base64');
    request.get(config['gozila-url'], prepare)
           .auth(credentials.username, credentials.password);
}


function prepare(err, resp, body) {
    if (err) {
        console.log(err);
        return;
    }

    var _config = JSON.parse(body);

    if (_config.error) {
        console.log(body);
        return;
    }

    // update config
    for (var key in _config) {
        config[key] = _config[key];
    }

    // update self or start proxy
    if (config.update && config.version){
        if (parseInt(config.version) > VERSION) {
            updateSelf();
        }
    } else {
        portfinder.getPort(function (err, port) {
            if (err) {
                console.log(err);
                return;
            }
            start(port);
        });
    }
};

function start(port) {
    useProxyNpmrc(port);
    startProxy(port);
}

function useProxyNpmrc(port) {
    var content = '_auth=' + config.auth;
    content += '\nalways-auth=true';
    content += '\nunsafe-perm=true';
    content += '\nregistry=http://127.0.0.1:' + port + '/';
    content += '\nemail=' + config.user + '@' + config.host;
    content += '\nloglevel=http';
    fs.writeFileSync(npmrc, content, 'utf8');
}

function startProxy(port) {
    console.log(gozila + '\n');
    console.log("Proxy running on port:", port);
    console.log("Tip: use [Ctrl-C] to exit.");
    http.createServer(proxyHandler).listen(port);
}

function updateSelf() {
    //TODO
}

function proxyHandler(req, res) {
    var proxy = httpProxy.createProxyServer({});
    var p = url.parse(req.url).path.split('/')[1];
    var isPublic = config['private-packages'].indexOf(p) === -1;
    var notSearch = p !== '-';

    console.log("\nrequesting:", req.url, "for", p);

    if (isPublic && notSearch) {//public
        var registry = selectRegistry(config['public-registry']);
    } else {// private
        var registry = selectRegistry(config['private-registry']);
    }

    var urlpart = url.parse(registry);
    req.headers.host = url.parse(registry).hostname;
    if (urlpart.port) {
        req.headers.host += ':' + urlpart.port;
    }
    console.log('use registry:', registry);

    proxy.web(req, res, { target: registry });
}

function selectRegistry(array) {
    // select a registry randomly
    var i = Math.floor(Math.random() * array.length);
    return array[i];
}

function readCredentials(cb) {
    var schema = {
        properties: {
            username: { required: true },
            password: {
                required: true,
                hidden: true
            }
        }
    };

    prompt.start();
    prompt.get(schema, cb);
}

var gozila = function() {
    return new String(function() {
/*
                               /(  /(
                              /  \/  \
                       /(/(  /    \___\
                      /  \.-~         ~-._
                /^\.-~   __            /^~~~^\
           /\.-~       /~  ~\         (o\   /o)
      /\.-~            |    |         |.     .|
 /\.-~  __             |    |         |\'. .'/|
~    .-~  ~-.          |    |         |\\___//|
    :        \         (    |    _.-~`\ \) )/ /
    \         \         \   \_.-~      \_( (_/
    '\         \        .\   \___        )/\)
      \         \   _.-~  \_  _ _\
       \         \-~        `\\\\\\
        \        /           )/)/)/
    ___.~)      /`-.
  _-    /      /    `-.(\
_-/-._.-\     /-.        \
  \    ( \   /   `-._     :
   \   | /   \_     (____.'
    \__||     ~-.___
     \/ /__________/>
*/
    }).substring(17,836);
}();