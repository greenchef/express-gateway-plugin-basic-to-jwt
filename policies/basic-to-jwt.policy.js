const auth = require('basic-auth');
const jwt = require('jsonwebtoken');
const request = require('request-promise-native');

const { defaultClient } = require('../initializers/redis');

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
  policy: ({ authUrl, nameProperty, passProperty, tokenProperty, cacheSeconds = 0 }) => {
    return async (req, res, next) => {
      try {
				const authHeader = (req.headers || {}).authorization;
				if (authHeader && authHeader.startsWith('Basic ')) {
          const credentials = auth(req);
          const redisKey = `${credentials.name}~?~${credentials.pass}`;
          const refreshRedisKey = `${credentials.name}~?~${credentials.pass}~?~refreshInProgress`;
          let token = await defaultClient.get(redisKey);
          let needsRefresh = null;
          if (token) {
            const refreshInProgress = await defaultClient.get(refreshRedisKey);
            if (!refreshInProgress) {
              const decodedToken = jwt.decode(token);
              if ((decodedToken.exp - (Date.now() / 1000)) <= 30) {
                defaultClient.set(refreshRedisKey, true, 'EX', 10);
                needsRefresh = true;
              }
            }
          }
          if (!token || needsRefresh) {
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
            if (cacheSeconds) {
              defaultClient.set(redisKey, token, 'EX', cacheSeconds);
            } else {
              defaultClient.set(redisKey, token);
            }
            if (needsRefresh) {
              defaultClient.del(refreshRedisKey);
            } 
          }
					req.headers = {
						...req.headers,
						authorization: `Bearer ${token}`,
					}
				}
      } catch (e) {
        defaultClient.del(refreshRedisKey);
        console.error('Error in basic-to-jwt policy:', e)
        res.sendStatus(e.statusCode)
        return;
      }
      next();
    };
  }
};

