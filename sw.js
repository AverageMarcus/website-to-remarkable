importScripts('sw-toolbox.js');
toolbox.precache([]);
toolbox.router.get('/*', toolbox.networkFirst, { networkTimeoutSeconds: 60 });
