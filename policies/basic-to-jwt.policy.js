const auth = require('basic-auth');
const request = require('request-promise-native');

const NodeCache = require( "node-cache" );
const tokenCache = new NodeCache( { stdTTL: 200, checkperiod: 220 } );

module.exports = {
  name: 'basic-to-jwt',
  schema: {
    $id: 'N/A',
    type: 'object',
    properties: {
      authUrl: { // Where to access the auth service for passing the basic credentials
        type: 'string',
      }
    }
  },
  policy: ({ authUrl, nameProperty, passProperty, tokenProperty }) => {
    return async (req, res, next) => {
      try {
				const authHeader = (req.headers || {}).authorization;
				if (authHeader && authHeader.startsWith('Basic ')) {
          const credentials = auth(req);
          let token = tokenCache.get(credentials.name);
          if (!token) {
            const response = await request({
              method: 'POST',
              uri: authUrl,
              body: {
                [nameProperty]: credentials.name,
                [passProperty]: credentials.pass
              },
              json: true
            });
            token = tokenProperty ? response[tokenProperty] : response;
            tokenCache.set(credentials.name, token);
          }
					req.headers = {
						...req.headers,
						authorization: `Bearer ${token}`,
					}
				}
      } catch (e) {
        console.error('Error in basic-to-jwt policy:', e.error)
        res.sendStatus(e.statusCode)
        return;
      }
      next();
    };
  }
};
