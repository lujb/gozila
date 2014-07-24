#!/usr/bin/env node
var fs = require('fs');
var url = require('url');
var path = require('path');
var http = require('http');
var _ = require('underscore');
var prompt = require('prompt');
var request = require('request');
var httpProxy = require('http-proxy');
var portfinder = require('portfinder');

var home = process.env.HOME;
var confpath = path.join(home, '.godzilla', 'gozila.json');
var npmrc = path.join(home, '.npmrc');

var VERSION = 201407241535;

// init proxy handler
var proxy = httpProxy.createProxyServer({});
/*proxy.on('proxyReq', function(proxyReq, req, res, options) { });
proxy.on('proxyRes', function (res) { });
*/


// load local config
try {
    var config = JSON.parse(fs.readFileSync(confpath, 'utf8'));
    verbose("- Load gozila config from", confpath, "...");
    for (var key in config){
        verbose("-  ", key+":", config[key]);
    }
} catch(err) {
    console.log(err);
    return;
}

// hold npmrc
var oldrc = '';
if (fs.existsSync(npmrc)) {
    oldrc = fs.readFileSync(npmrc, 'utf8');
    verbose("- Backup current .npmrc ...");
}

// trap `CTRL-C`
verbose("- Trap SIGINT signal ...");
require('shutdown-handler').on('exit', function() {
    fs.writeFileSync(npmrc, oldrc, 'utf8');
    verbose("- Recover .npmrc ...");
});

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

    verbose("- Auth user credentials ...");
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

    verbose("- Get gozila server config ...");

    // update config
    for (var key in _config) {
        verbose("-  ", key+":", _config[key]);
        config[key] = _config[key];
    }

    // update or start
    if (config.update && config.version){
        if (parseInt(config.version) > VERSION) {
            console.log("* A newer version found:", config.version, "(current:", VERSION+")");
            updateSelf();
        } else {
            start();
        }
    } else {
        start();
    }
};

function start() {
    verbose("- Select unused port ...");
    portfinder.getPort(function (err, port) {
        if (err) {
            console.log(err);
            return;
        }
        useProxyNpmrc(port);
        startProxy(port);
    });
}

function useProxyNpmrc(port) {
    var content = '_auth=' + config.auth;
    content += '\nalways-auth=true';
    content += '\nunsafe-perm=true';
    content += '\nregistry=http://127.0.0.1:' + port + '/';
    content += '\nemail=' + config.user + '@' + config.host;
    content += '\nloglevel=http';

    verbose("- Apply new .npmrc ...");
    verbose(content);
    fs.writeFileSync(npmrc, content, 'utf8');
}

function startProxy(port) {
    console.log(gozila + '\n');
    console.log("Proxy running on port:", port);
    console.log("Version:", VERSION);
    console.log("Tip: use [Ctrl-C] to exit.");
    http.createServer(proxyHandler).listen(port);
}

function updateSelf() {
    verbose("- Update gozila ...");
    //TODO
    console.log("* gozila can't update itself automatically, please update manually.");
}

function proxyHandler(req, res) {
    var p = url.parse(req.url).path.split('/')[1];
    var notSearch = p !== '-';
    var isPrivate = _.some(config['private-packages'], function(s){
        return (new RegExp("^"+s)).test(p);
    });

    console.log("\nrequesting:", req.url, "for", p);

    if (!isPrivate && notSearch) {//public
        var registry = selectRegistry(config['public-registry']);
        var urlpart = url.parse(registry);
        req.headers.host = url.parse(registry).hostname;
        if (urlpart.port) {
            req.headers.host += ':' + urlpart.port;
        }
    } else {// private
        var registry = selectRegistry(config['private-registry']);
        req.headers.host = config['registry-host'];
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
    verbose("- Read user credentials ...");
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

function verbose() {
    if (config && config.verbose) {
        console.log.apply(this, arguments);
    }
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
    ___.~)      /
  _-    /      /
_-/    -\     /
  \    ( \   /
   \   | /   \_
    \__||     ~-.___
     \/ /__________/>
*/
    }).substring(17,788);
}();
