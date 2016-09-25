'use strict';

// Load modules

const Fs = require('fs');

const Bell = require('bell');
const Hapi = require('hapi');
const Hoek = require('hoek');
const Inert = require('inert');


// Declare internals

const internals = {
    strategies: [
        { name: 'github' },
        { name: 'facebook' },
        { name: 'twitter' },
        { name: 'auth0', config: { domain: 'hapijs-bell.auth0.com' } }
    ]
};


internals.htmlContent = Fs.readFileSync('index.html').toString();


internals.setupStaticRoutes = function () {

    server.route([
        { method: 'GET', path: '/', handler: function (request, reply) {

            const html = internals.htmlContent.replace('%%CONTENT%%', internals.strategies.reduce(internals.buildContent(request.state), ''));
            return reply(html).type('text/html');
        } },
        { method: 'GET', path: '/css/{param}', handler: { directory: { path: './css', redirectToSlash: false, index: false } } },
        { method: 'GET', path: '/js/{param*}', handler: { directory: { path: './js', redirectToSlash: false, index: false } } },
        { method: 'GET', path: '/forkme_right_orange_ff7600.png', handler: { file: './forkme_right_orange_ff7600.png' } }
    ]);
};


internals.buildContent = function (state) {

    return function (prev, current) {

        const cookie = state[current.name] || {};
        const authStatus = cookie.credentials ? 'auth' : cookie.error ? 'error' : 'none';

        return `${prev}
      <div class="column">
        <div class="callout" data-equalizer-watch>
          <div class="clearfix">
            <h4 class="float-left">${current.name}</h4>
            ${
            authStatus === 'auth' ? '<span class="success label float-right" style="margin-top: 5px">Authenticated</span>'
                : authStatus === 'error' ? '<span class="alert label float-right" style="margin-top: 5px">Authentication Error</span>'
                    : '<span class="secondary label float-right" style="margin-top: 5px">Not Authenticated</span>'
            }
          </div>
          <pre class="json">${JSON.stringify(cookie, null, 2)}</pre>
          <div class="clearfix">
            <p>To log in with this provider, click the button below</p>
            <a href="/${current.name}" class="button">Log In via ${current.name}</a>
          </div>
        </div>
      </div>
`;
    };
};


internals.setupStrategy = function (strategy) {

    server.auth.strategy(strategy.name, 'bell', {
        provider: strategy.name,
        password: process.env.cookie_password === '@cookie_password' ? 'abcdefghijklmnopqrstuvwxyz1234567890' : process.env.cookie_password,
        isSecure: true,
        isHttpOnly: true,
        forceHttps: true,
        domain: 'bell.now.sh',
        clientId: process.env[`${strategy.name}_id`],
        clientSecret: process.env[`${strategy.name}_secret`],
        location: 'https://bell.now.sh',
        config: strategy.config || {}
    });

    server.state(strategy.name, {
        ttl: null,
        isSecure: true,
        isHttpOnly: true,
        isSameSite: 'Strict',
        path: '/',
        domain: 'bell.now.sh',
        encoding: 'iron',
        password: process.env.cookie_password === '@cookie_password' ? 'abcdefghijklmnopqrstuvwxyz1234567890' : process.env.cookie_password,
        ignoreErrors: true,
        clearInvalid: true
    });

    server.route({
        method: '*',
        path: `/${strategy.name}`,
        config: {
            auth: {
                strategy: strategy.name,
                mode: 'try'
            },
            handler: function (request, reply) {

                const respCookie = request.auth.isAuthenticated ? {
                    credentials: request.auth.credentials
                } : {
                    error: request.auth.error
                };

                return reply().state(strategy.name, respCookie).redirect('/');
            }
        }
    });
};


const server = new Hapi.Server();
server.connection({ port: 3002 });

server.register([Bell, Inert], (err) => {

    Hoek.assert(!err, err);
    internals.setupStaticRoutes();
    internals.strategies.forEach(internals.setupStrategy);
    server.start((err) => {

        Hoek.assert(!err, err);
    });
});